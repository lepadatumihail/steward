/**
 * The live scan pipeline: harvested events -> ground truth -> assessment.
 *
 * Events are only leads. The pipeline:
 *   1. harvest candidate (token, spender) pairs from logs,
 *   2. read every allowance LIVE via Multicall3 (events are forgeable and
 *      stale; the chain's current word is the only one that counts),
 *   3. keep pairs with a nonzero allowance,
 *   4. fetch token metadata + owner balance for those survivors,
 *   5. check spender verification on the explorer (mainnet, capped),
 *   6. score with the same rubric the fixtures use.
 *
 * Token name/symbol arrive here as attacker-controlled bytes. They are passed
 * through UNTOUCHED: quarantine happens at the presentation boundary
 * (lib/steward/format.ts and the UI), never silently in the middle, so the
 * risk scorer gets to see the raw hostile string it is scoring.
 */

import { erc20Abi, formatUnits, getAddress } from "viem";
import { assessApproval } from "../steward/risk";
import { knownProtocolFor } from "../steward/risk";
import type { Approval, AssessedApproval, ChainId } from "../steward/types";
import {
  harvestBaseRecent,
  harvestMainnet,
  type RawApproval,
} from "./approval-logs";
import { clientFor } from "./chains";

const UNLIMITED_THRESHOLD = 1n << 255n;
const SPENDER_VERIFY_CAP = 40;
/** Worst-N returned to callers; a 2,000-row payload helps nobody. */
const RESULT_CAP = 60;
const CACHE_TTL_MS = 10 * 60 * 1000;
/**
 * Empty results age fast: a wallet whose approve landed seconds ago, or one
 * that was just revoked on camera, must not read stale for ten minutes.
 */
const EMPTY_CACHE_TTL_MS = 60 * 1000;

export interface ScanResult {
  approvals: AssessedApproval[];
  meta: {
    chain: ChainId;
    coverage: string;
    truncated: boolean;
    pairsFromLogs: number;
    liveNonzero: number;
    scannedAt: string;
  };
}

/**
 * Per-instance cache + in-flight dedupe. Serverless instances each get their
 * own copy, which is fine: the goal is absorbing repeat clicks and repeat
 * agent calls, not global consistency.
 */
const cache = new Map<string, { at: number; result: ScanResult }>();
const inflight = new Map<string, Promise<ScanResult>>();

export async function scanAddress(
  rawAddress: string,
  chain: ChainId,
): Promise<ScanResult> {
  const address = getAddress(rawAddress); // checksums + validates
  const key = `${chain}:${address.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit) {
    const ttl =
      hit.result.meta.liveNonzero > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
    if (Date.now() - hit.at < ttl) return hit.result;
  }

  const running = inflight.get(key);
  if (running) return running;

  const work = doScan(address, chain).then((result) => {
    cache.set(key, { at: Date.now(), result });
    inflight.delete(key);
    return result;
  });
  work.catch(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}

async function doScan(address: string, chain: ChainId): Promise<ScanResult> {
  const harvest =
    chain === "ethereum"
      ? await harvestMainnet(address)
      : await harvestBaseRecent(address);

  const client = clientFor(chain);
  const pairs = harvest.pairs;

  // ---- 2. live allowance ground truth --------------------------------------
  const allowances = await client.multicall({
    contracts: pairs.map((p) => ({
      address: p.token as `0x${string}`,
      abi: erc20Abi,
      functionName: "allowance" as const,
      args: [address as `0x${string}`, p.spender as `0x${string}`],
    })),
    allowFailure: true,
    batchSize: 2048,
  });

  // ---- 3. survivors --------------------------------------------------------
  const live: Array<{ raw: RawApproval; allowance: bigint }> = [];
  pairs.forEach((p, i) => {
    const r = allowances[i];
    if (r.status === "success" && typeof r.result === "bigint" && r.result > 0n) {
      live.push({ raw: p, allowance: r.result });
    }
  });

  // ---- 4. metadata + balances for surviving tokens -------------------------
  const tokens = [...new Set(live.map((l) => l.raw.token))];
  const metaCalls = tokens.flatMap((t) => [
    { address: t as `0x${string}`, abi: erc20Abi, functionName: "name" as const },
    { address: t as `0x${string}`, abi: erc20Abi, functionName: "symbol" as const },
    { address: t as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
    {
      address: t as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address as `0x${string}`],
    },
  ]);
  const metaResults = await client.multicall({
    contracts: metaCalls,
    allowFailure: true,
    batchSize: 2048,
  });
  const tokenMeta = new Map<
    string,
    { name: string; symbol: string; decimals: number; balance: bigint }
  >();
  tokens.forEach((t, i) => {
    const [name, symbol, decimals, balance] = metaResults.slice(i * 4, i * 4 + 4);
    tokenMeta.set(t, {
      name: name.status === "success" ? String(name.result) : "(no name)",
      symbol: symbol.status === "success" ? String(symbol.result) : "???",
      decimals:
        decimals.status === "success" ? Number(decimals.result) : 18,
      balance:
        balance.status === "success" && typeof balance.result === "bigint"
          ? balance.result
          : 0n,
    });
  });

  // ---- 5+6. assemble, score, then spend the verification budget where it
  // matters. A busy wallet yields thousands of live pairs but only the worst
  // ~RESULT_CAP are ever shown, so: score everything with a conservative
  // default (unverified), sort, and buy explorer lookups only for the head.
  const build = (
    raw: RawApproval,
    allowance: bigint,
    isVerified: boolean,
  ): AssessedApproval => {
    const meta = tokenMeta.get(raw.token)!;
    const exposure = allowance < meta.balance ? allowance : meta.balance;
    const approval: Approval = {
      id: `${chain}:${raw.token}:${raw.spender}`,
      chain,
      token: {
        address: raw.token,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      },
      spender: {
        address: raw.spender,
        verified: isVerified,
        knownProtocol: knownProtocolFor(raw.spender),
      },
      allowanceRaw: allowance.toString(),
      isUnlimited: allowance >= UNLIMITED_THRESHOLD,
      approvedAt: raw.timestamp
        ? new Date(raw.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      exposureRaw: exposure.toString(),
    };
    return { ...approval, risk: assessApproval(approval) };
  };

  let approvals = live.map(({ raw, allowance }) =>
    build(raw, allowance, Boolean(knownProtocolFor(raw.spender))),
  );
  approvals.sort((a, b) => b.risk.score - a.risk.score);

  const headSpenders = [
    ...new Set(approvals.slice(0, RESULT_CAP).map((a) => a.spender.address)),
  ];
  const verified = await verifySpenders(chain, headSpenders);
  if (verified.size > 0) {
    approvals = approvals.map((a) => {
      const v = verified.get(a.spender.address);
      if (v === undefined || v === a.spender.verified) return a;
      const patched = { ...a, spender: { ...a.spender, verified: v } };
      return { ...patched, risk: assessApproval(patched) };
    });
    approvals.sort((a, b) => b.risk.score - a.risk.score);
  }

  const totalNonzero = approvals.length;
  approvals = approvals.slice(0, RESULT_CAP);

  return {
    approvals,
    meta: {
      chain,
      coverage: harvest.coverage,
      truncated: harvest.truncated,
      pairsFromLogs: pairs.length,
      liveNonzero: totalNonzero,
      scannedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------

const spenderCache = new Map<string, boolean>();

/**
 * Explorer verification for unknown spenders. Mainnet only — Blockscout Base
 * is unusable and nothing else serves this keyless, so on Base an unknown
 * spender simply stays "unverified" and the risk reasons say why that is
 * conservative. Best-effort: any failure reads as unverified, never as a
 * scan failure.
 */
async function verifySpenders(
  chain: ChainId,
  spenders: string[],
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (chain !== "ethereum") return out;

  const todo = spenders
    .filter((s) => !knownProtocolFor(s))
    .filter((s) => {
      if (spenderCache.has(s)) {
        out.set(s, spenderCache.get(s)!);
        return false;
      }
      return true;
    })
    .slice(0, SPENDER_VERIFY_CAP);

  const CONCURRENCY = 6;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.allSettled(
      todo.slice(i, i + CONCURRENCY).map(async (spender) => {
        try {
          const res = await fetch(
            `https://eth.blockscout.com/api/v2/smart-contracts/${spender}`,
            { signal: AbortSignal.timeout(8_000) },
          );
          if (res.ok) {
            const isVerified =
              ((await res.json()) as { is_verified?: boolean }).is_verified ===
              true;
            spenderCache.set(spender, isVerified);
            out.set(spender, isVerified);
          } else if (res.status === 404) {
            // Definitive: not a verified contract. Safe to cache.
            spenderCache.set(spender, false);
            out.set(spender, false);
          } else {
            // Throttle/5xx: unverified for THIS scan only — never cached,
            // or one bad minute would darken every later scan on the instance.
            out.set(spender, false);
          }
        } catch {
          out.set(spender, false); // conservative, and NOT cached
        }
      }),
    );
  }

  // Known protocols count as verified without a lookup.
  for (const s of spenders) {
    if (knownProtocolFor(s)) out.set(s, true);
  }
  return out;
}

/** Small helper the route uses for a human-readable exposure figure. */
export function describeExposure(a: AssessedApproval): string {
  try {
    return formatUnits(BigInt(a.exposureRaw), a.token.decimals);
  } catch {
    return "?";
  }
}
