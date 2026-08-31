/**
 * GET /api/gas?chain=ethereum|base
 *
 * Fee read from eth_feeHistory over the last 40 blocks (~8 min on mainnet,
 * ~80s on Base). The verdict is honest about its window: "cheap" means cheap
 * relative to the recent past, not to history.
 */

import { formatGwei } from "viem";
import { clientFor } from "@/lib/server/chains";
import type { ChainId } from "@/lib/steward/types";

export const maxDuration = 15;

interface GasRead {
  chain: ChainId;
  baseFeeGwei: number;
  priorityP50Gwei: number;
  windowMinGwei: number;
  windowMedianGwei: number;
  windowMaxGwei: number;
  verdict: "cheap" | "typical" | "elevated";
  /** Rough cost of one ERC-20 revoke (~46k gas) at current fees, in gwei-gas. */
  revokeCostEth: string;
  windowDescription: string;
  checkedAt: string;
}

const cache = new Map<string, { at: number; read: GasRead }>();
const CACHE_TTL_MS = 30 * 1000;

export async function GET(request: Request): Promise<Response> {
  const chainParam = new URL(request.url).searchParams.get("chain") ?? "ethereum";
  if (chainParam !== "ethereum" && chainParam !== "base") {
    return new Response(
      JSON.stringify({ error: `Unknown chain "${chainParam}".` }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  const chain = chainParam as ChainId;

  const hit = cache.get(chain);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return ok(hit.read);

  try {
    const client = clientFor(chain);
    const history = await client.getFeeHistory({
      blockCount: 40,
      rewardPercentiles: [50],
    });
    const fees = history.baseFeePerGas.map((f) => Number(formatGwei(f)));
    const current = fees[fees.length - 1] ?? 0;
    const sorted = [...fees].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? current;
    const priority =
      history.reward && history.reward.length > 0
        ? Number(
            formatGwei(
              history.reward[history.reward.length - 1]?.[0] ?? 0n,
            ),
          )
        : 0;

    const verdict: GasRead["verdict"] =
      current < median * 0.9
        ? "cheap"
        : current > median * 1.3
          ? "elevated"
          : "typical";

    // ERC-20 approve(spender, 0) measures ~46k gas.
    const revokeCostEth = (
      ((current + priority) * 46_000) /
      1e9
    ).toFixed(6);

    const read: GasRead = {
      chain,
      baseFeeGwei: round(current),
      priorityP50Gwei: round(priority),
      windowMinGwei: round(sorted[0] ?? 0),
      windowMedianGwei: round(median),
      windowMaxGwei: round(sorted[sorted.length - 1] ?? 0),
      verdict,
      revokeCostEth,
      windowDescription:
        chain === "ethereum"
          ? "last 40 blocks (~8 minutes)"
          : "last 40 blocks (~80 seconds)",
      checkedAt: new Date().toISOString(),
    };
    cache.set(chain, { at: Date.now(), read });
    return ok(read);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return new Response(
      JSON.stringify({ error: `Gas read unavailable: ${message}` }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function ok(read: GasRead): Response {
  return new Response(JSON.stringify(read), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, s-maxage=30",
    },
  });
}
