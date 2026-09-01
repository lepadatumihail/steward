/** Steward's domain nouns. */

export type ChainId = "ethereum" | "base";

export interface TokenRef {
  address: string;
  /** ATTACKER-CONTROLLED. Never render or emit without quarantine. */
  name: string;
  /** ATTACKER-CONTROLLED. Never render or emit without quarantine. */
  symbol: string;
  decimals: number;
}

export interface Spender {
  address: string;
  /** ATTACKER-CONTROLLED when it comes from on-chain metadata. */
  label?: string;
  /** Verified source code on the chain's explorer. */
  verified: boolean;
  /** Present only for spenders on Steward's curated allowlist. */
  knownProtocol?: string;
}

export interface Approval {
  /** Stable key: chain:token:spender */
  id: string;
  chain: ChainId;
  token: TokenRef;
  spender: Spender;
  /** uint256 as a decimal string. */
  allowanceRaw: string;
  /** allowance === 2^256-1 (or close enough that it never depletes). */
  isUnlimited: boolean;
  /** ISO date of the approving transaction. */
  approvedAt: string;
  /** Balance at risk right now, as a decimal string in token units. */
  exposureRaw: string;
}

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface RiskAssessment {
  level: RiskLevel;
  /** 0-100. Higher is worse. */
  score: number;
  /** Human-readable, ordered by contribution. */
  reasons: string[];
  /** Quarantine flags raised by this approval's on-chain metadata. */
  metadataFlags: readonly string[];
}

export interface AssessedApproval extends Approval {
  risk: RiskAssessment;
}

/** A write the agent has prepared but cannot perform. */
export interface StagedAction {
  id: string;
  kind: "revoke" | "transfer" | "approve" | "swap";
  chain: ChainId;
  /** The address the user's wallet will be asked to transact with. */
  to: string;
  /** ABI-encoded calldata; absent for a native-ETH transfer. */
  data?: string;
  /** Native value in wei as a decimal string; absent for contract calls. */
  valueWei?: string;
  /** Plain-language description shown in Steward's own confirmation UI. */
  summary: string;
  /** Extra facts worth showing on the card (min received, risk verdict…). */
  meta?: string[];
  /** Present when the action targets a scanned approval. */
  approvalId?: string;
  createdAt: string;
}

/** Cross-source token risk intelligence, composed server-side. */
export interface TokenIntel {
  address: string;
  chain: ChainId;
  token: { name: string; symbol: string; decimals: number };
  /** Which keyless sources answered; a verdict needs at least two. */
  sources: { goplus: boolean; dexscreener: boolean; honeypot: boolean };
  market: {
    /** Number, not the raw API string — see token-intel's coercion note. */
    priceUsd: number | null;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    priceChange24hPct: number | null;
  } | null;
  /** Human-readable risk signals, worst first. */
  signals: string[];
  verdict: "high-risk" | "caution" | "no-major-flags" | "insufficient-data";
  /** Best-effort price trend (Codex); absent when the keyed source is down. */
  trend?: { change7dPct: number | null; change30dPct: number | null };
  checkedAt: string;
}

/** Chains Steward supports. Single source of truth for parsing agent input. */
export const SUPPORTED_CHAINS: readonly ChainId[] = ["ethereum", "base"];

/**
 * Parse a chain argument from an agent.
 *
 * Two rules the hand-rolled ternaries got wrong:
 *  - ONE default across every tool, so the documented discover -> assess ->
 *    swap flow cannot silently change chains mid-pipeline;
 *  - an unrecognised chain THROWS instead of coercing, so "polygon" is an
 *    error the agent can correct, not an Ethereum transfer it never intended.
 */
export function parseChainArg(raw: string | undefined | null): ChainId {
  if (raw == null || raw.trim() === "") return DEFAULT_CHAIN;
  const v = raw.trim().toLowerCase();
  const hit = SUPPORTED_CHAINS.find((c) => c === v);
  if (hit) return hit;
  throw new Error(
    `Unsupported chain "${raw}". Steward supports: ${SUPPORTED_CHAINS.join(", ")}.`,
  );
}

/** The one default. Base: cheap gas, where the demo and most staging happens. */
export const DEFAULT_CHAIN: ChainId = "base";
