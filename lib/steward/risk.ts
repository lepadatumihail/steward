/**
 * Steward's approval risk rubric (v1).
 *
 * Constrained to signals the keyless data stack can actually produce:
 * allowance size, approval age, live balance, explorer verification status,
 * a small curated allowlist, and the quarantine flags raised by the token's
 * own metadata.
 *
 * Every score is additive and every contribution is reported, because a risk
 * number a user cannot interrogate is a number they should not trust.
 */

import { sanitizeUntrusted } from "../webmcp/quarantine";
import type { Approval, RiskAssessment, RiskLevel } from "./types";

const DAY_MS = 86_400_000;

/** Spenders we are willing to vouch for. Address -> protocol name. */
const KNOWN_PROTOCOLS: Record<string, string> = {
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap Universal Router",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch V5 Router",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
};

export function knownProtocolFor(address: string): string | undefined {
  return KNOWN_PROTOCOLS[address.toLowerCase()];
}

interface Contribution {
  points: number;
  reason: string;
}

export function assessApproval(
  approval: Approval,
  now: number = Date.now(),
): RiskAssessment {
  const contributions: Contribution[] = [];

  // --- Metadata quarantine signals -----------------------------------------
  // Checked first: a token whose NAME is an attack is the loudest signal there
  // is, and it must survive into the assessment rather than being sanitised away.
  const nameCheck = sanitizeUntrusted(approval.token.name);
  const symbolCheck = sanitizeUntrusted(approval.token.symbol);
  const metadataFlags = [
    ...new Set([...nameCheck.flags, ...symbolCheck.flags]),
  ].filter((f) => f !== "truncated");

  const hostileFlags = metadataFlags.filter(
    (f) => f !== "non-string" && f !== "unprintable",
  );
  if (hostileFlags.length > 0) {
    contributions.push({
      points: 35,
      reason: `Token metadata contains attack-shaped content (${hostileFlags.join(", ")}) — treated as data, never as instructions`,
    });
  }

  // --- Allowance size -------------------------------------------------------
  const exposure = safeBigInt(approval.exposureRaw);
  if (approval.isUnlimited) {
    contributions.push({
      points: exposure > 0n ? 40 : 25,
      reason:
        exposure > 0n
          ? "Unlimited allowance on a token you currently hold"
          : "Unlimited allowance (no balance at risk today, but it applies to any future balance)",
    });
  } else if (exposure > 0n) {
    const allowance = safeBigInt(approval.allowanceRaw);
    if (allowance >= exposure) {
      contributions.push({
        points: 20,
        reason: "Allowance covers your entire current balance",
      });
    }
  }

  // --- Spender trust --------------------------------------------------------
  const known = approval.spender.knownProtocol ?? knownProtocolFor(approval.spender.address);
  if (known) {
    contributions.push({
      points: -20,
      reason: `Spender is a recognised protocol (${known})`,
    });
  } else if (!approval.spender.verified) {
    contributions.push({
      points: 25,
      reason: "Spender contract source is unverified on the block explorer",
    });
  } else {
    contributions.push({
      points: 10,
      reason: "Spender is verified but not a protocol Steward recognises",
    });
  }

  // --- Staleness ------------------------------------------------------------
  const ageDays = Math.floor(
    (now - Date.parse(approval.approvedAt)) / DAY_MS,
  );
  if (Number.isFinite(ageDays)) {
    if (ageDays >= 365) {
      contributions.push({
        points: 20,
        reason: `Approved ${Math.floor(ageDays / 365)}y ago and never revoked`,
      });
    } else if (ageDays >= 180) {
      contributions.push({
        points: 12,
        reason: `Approved ${ageDays} days ago and never revoked`,
      });
    }
  }

  const score = clamp(
    contributions.reduce((sum, c) => sum + c.points, 0),
    0,
    100,
  );

  return {
    level: levelFor(score),
    score,
    reasons: contributions
      .slice()
      .sort((a, b) => b.points - a.points)
      .map((c) => c.reason),
    metadataFlags,
  };
}

function levelFor(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function safeBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}
