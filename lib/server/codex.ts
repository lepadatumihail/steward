/**
 * Codex.io — the discovery lane and trend enrichment.
 *
 * This is Steward's ONE keyed dependency, and it is quarantined accordingly:
 *
 *  - Only `discover_tokens` hard-depends on it. If the key dies (it is shared
 *    with another project and burned through its quota once already, in
 *    August), discovery returns one honest error line and NOTHING else in the
 *    app degrades. The token-intel trend enrichment is best-effort.
 *  - The key lives in CODEX_API_KEY (Vercel env / .env.local), never in the
 *    repo.
 *  - Everything Codex returns about a token (name, symbol) is
 *    attacker-controlled text and goes through the same quarantine as
 *    on-chain metadata at the presentation boundary.
 *  - Discovery rows are MARKET FACTS, not endorsements. The tool output says
 *    so and instructs the agent to vet candidates with assess_token before
 *    proposing anything — and stage_swap's page-side gate backstops an agent
 *    that skips the advice.
 */

import type { ChainId } from "../steward/types";

const CODEX_URL = "https://graph.codex.io/graphql";
const NETWORK_ID: Record<ChainId, number> = { ethereum: 1, base: 8453 };

export interface DiscoveredToken {
  address: string;
  /** ATTACKER-CONTROLLED — quarantine before showing to anyone. */
  name: string;
  /** ATTACKER-CONTROLLED — quarantine before showing to anyone. */
  symbol: string;
  priceUsd: number | null;
  volume24Usd: number;
  liquidityUsd: number;
  change24Pct: number | null;
  holders: number | null;
}

export interface TokenTrend {
  change7dPct: number | null;
  change30dPct: number | null;
}

class CodexUnavailable extends Error {}

async function gql<T>(query: string): Promise<T> {
  const key = process.env.CODEX_API_KEY;
  if (!key) {
    throw new CodexUnavailable(
      "discovery is not configured on this deployment (no data-source key)",
    );
  }
  const res = await fetch(CODEX_URL, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: key },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new CodexUnavailable(
      res.status === 401 || res.status === 403 || res.status === 429
        ? "discovery data source is over quota or unauthorized right now"
        : `discovery data source HTTP ${res.status}`,
    );
  }
  const body = (await res.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (body.errors?.length) {
    throw new CodexUnavailable(
      `discovery query failed: ${body.errors[0]?.message ?? "unknown"}`,
    );
  }
  if (!body.data) throw new CodexUnavailable("discovery returned no data");
  return body.data;
}

const discoverCache = new Map<string, { at: number; rows: DiscoveredToken[] }>();
const DISCOVER_TTL_MS = 60 * 1000;

/**
 * Volume-ranked movers with floors that pre-filter the worst junk:
 * real liquidity, real volume, a non-trivial holder base. The floors are a
 * coarse sieve, not a verdict — probe data showed pair-aggregation quirks
 * (a "token" with $149M volume and 25 holders), which is exactly why the
 * flow forces candidates through assess_token before any swap is staged.
 */
export async function discoverTokens(
  chain: ChainId,
  limit = 8,
): Promise<DiscoveredToken[]> {
  // Key on the CLAMPED value: limit=11, 12, 5000 all produce the same 10 rows,
  // so keying on the raw parameter made every one a guaranteed miss — an
  // attacker-drivable way to burn the one keyed quota and grow this Map.
  const capped = Math.min(Math.max(Math.trunc(limit) || 8, 1), 10);
  const key = `${chain}:${capped}`;
  const hit = discoverCache.get(key);
  if (hit && Date.now() - hit.at < DISCOVER_TTL_MS) return hit.rows;
  const data = await gql<{
    filterTokens?: {
      results?: Array<{
        token?: { address?: string; name?: string; symbol?: string };
        priceUSD?: string | number;
        volume24?: string | number;
        liquidity?: string | number;
        change24?: string | number;
        holders?: number;
      }>;
    };
  }>(`query {
    filterTokens(
      filters: {
        network: [${NETWORK_ID[chain]}],
        liquidity: { gt: 250000 },
        volume24: { gt: 250000 },
        holders: { gt: 1000 }
      },
      rankings: [{ attribute: volume24, direction: DESC }],
      limit: ${capped}
    ) {
      results {
        token { address name symbol }
        priceUSD volume24 liquidity change24 holders
      }
    }
  }`);

  const num = (v: string | number | undefined): number | null => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };

  const rows: DiscoveredToken[] = (data.filterTokens?.results ?? [])
    .filter((r) => r.token?.address)
    .map((r) => ({
      address: (r.token!.address as string).toLowerCase(),
      name: r.token!.name ?? "(unnamed)",
      symbol: r.token!.symbol ?? "???",
      priceUsd: num(r.priceUSD),
      volume24Usd: num(r.volume24) ?? 0,
      liquidityUsd: num(r.liquidity) ?? 0,
      change24Pct:
        num(r.change24) == null ? null : (num(r.change24) as number) * 100,
      holders: r.holders ?? null,
    }));

  discoverCache.set(key, { at: Date.now(), rows });
  return rows;
}

/** Best-effort 7d/30d trend from daily closes. Null on any failure. */
export async function tokenTrend(
  address: string,
  chain: ChainId,
): Promise<TokenTrend> {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 30 * 86400;
    const data = await gql<{ getBars?: { c?: Array<number | null> } }>(
      `query { getBars(symbol: "${address.toLowerCase()}:${NETWORK_ID[chain]}", from: ${from}, to: ${to}, resolution: "1D") { c } }`,
    );
    const closes = (data.getBars?.c ?? []).filter(
      (c): c is number => typeof c === "number" && c > 0,
    );
    const last = closes[closes.length - 1];
    if (!last || closes.length < 2) return { change7dPct: null, change30dPct: null };
    const week = closes.length >= 8 ? closes[closes.length - 8] : null;
    return {
      change7dPct: week ? ((last / week - 1) * 100) : null,
      change30dPct: closes[0] ? ((last / closes[0] - 1) * 100) : null,
    };
  } catch {
    return { change7dPct: null, change30dPct: null };
  }
}
