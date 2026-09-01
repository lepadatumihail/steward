/**
 * Cross-source token risk intelligence — the trading-partner brain.
 *
 * Three keyless sources, all probe-verified healthy on 2026-09-01, each blind
 * to the others' failure modes:
 *   - GoPlus:      contract-level security (source verified, honeypot, taxes,
 *                  mintability, owner powers)
 *   - DexScreener: market reality (price, liquidity, volume) — a token with no
 *                  market is a token you cannot exit
 *   - Honeypot.is: behavioural simulation (can a buy actually be sold?)
 *
 * The project's standing never-single-source rule applies: a verdict stronger
 * than "insufficient-data" requires at least two sources to have answered.
 * The probes have a live example of why — a spam token that reads clean on
 * GoPlus and is only caught by its $2k liquidity.
 *
 * This module states SECURITY findings about a token, never investment advice.
 */

import { erc20Abi } from "viem";
import { tokenTrend } from "./codex";
import { sanitizeUntrusted } from "../webmcp/quarantine";
import type { ChainId, TokenIntel } from "../steward/types";
import { clientFor } from "./chains";

const GOPLUS_CHAIN: Record<ChainId, string> = { ethereum: "1", base: "8453" };
const HONEYPOT_CHAIN: Record<ChainId, string> = { ethereum: "1", base: "8453" };

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; intel: TokenIntel }>();

async function getJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function assessToken(
  address: string,
  chain: ChainId,
): Promise<TokenIntel> {
  const key = `${chain}:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.intel;

  const addr = address.toLowerCase();
  const client = clientFor(chain);

  const [metaR, goplusR, dexR, honeyR, trendR] = await Promise.allSettled([
    client.multicall({
      contracts: [
        { address: addr as `0x${string}`, abi: erc20Abi, functionName: "name" },
        { address: addr as `0x${string}`, abi: erc20Abi, functionName: "symbol" },
        { address: addr as `0x${string}`, abi: erc20Abi, functionName: "decimals" },
      ],
      allowFailure: true,
    }),
    getJson(
      `https://api.gopluslabs.io/api/v1/token_security/${GOPLUS_CHAIN[chain]}?contract_addresses=${addr}`,
    ),
    getJson(`https://api.dexscreener.com/latest/dex/tokens/${addr}`),
    getJson(
      `https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=${HONEYPOT_CHAIN[chain]}`,
    ),
    // Best-effort enrichment from the one keyed source; never load-bearing
    // and deliberately NOT counted toward the two-source verdict rule.
    tokenTrend(addr, chain),
  ]);

  // ---- on-chain identity ----------------------------------------------------
  let name = "(unreadable)";
  let symbol = "???";
  let decimals = 18;
  if (metaR.status === "fulfilled") {
    const [n, sy, d] = metaR.value;
    if (n.status === "success") name = String(n.result);
    if (sy.status === "success") symbol = String(sy.result);
    if (d.status === "success") decimals = Number(d.result);
  }

  const signals: string[] = [];
  let high = 0;
  let caution = 0;

  // ---- metadata injection check (our own lens, always available) ------------
  const nameFlags = sanitizeUntrusted(name).flags.filter(
    (f) => f !== "truncated",
  );
  if (nameFlags.length > 0) {
    high++;
    signals.push(
      `Token name carries attack-shaped content (${nameFlags.join(", ")}) — a token that talks to agents is hostile by construction`,
    );
  }

  // ---- GoPlus ---------------------------------------------------------------
  const goplusOk = goplusR.status === "fulfilled";
  if (goplusOk) {
    const entry = (
      goplusR.value as { result?: Record<string, Record<string, unknown>> }
    ).result?.[addr];
    if (entry) {
      const flag = (k: string) => entry[k] === "1";
      const num = (k: string) => parseFloat(String(entry[k] ?? "")) || 0;
      if (flag("is_honeypot")) {
        high++;
        signals.push("GoPlus marks this a honeypot: buys cannot be sold");
      }
      if (num("sell_tax") >= 0.1) {
        high++;
        signals.push(`Sell tax ${(num("sell_tax") * 100).toFixed(0)}% (GoPlus)`);
      } else if (num("sell_tax") >= 0.03) {
        caution++;
        signals.push(`Sell tax ${(num("sell_tax") * 100).toFixed(1)}% (GoPlus)`);
      }
      if (flag("cannot_sell_all")) {
        high++;
        signals.push("Holders cannot sell their full balance (GoPlus)");
      }
      if (entry["is_open_source"] === "0") {
        caution++;
        signals.push("Contract source is not verified (GoPlus)");
      }
      if (flag("is_mintable")) {
        caution++;
        signals.push("Supply is mintable by the owner (GoPlus)");
      }
      if (flag("owner_change_balance")) {
        high++;
        signals.push("Owner can edit holder balances (GoPlus)");
      }
      if (flag("is_proxy")) {
        // Informational only: every major stablecoin is a proxy. It matters
        // in combination with other flags, not alone.
        signals.push("Upgradeable proxy — behaviour can change after review (GoPlus)");
      }
    }
  }

  // ---- DexScreener ----------------------------------------------------------
  const dexOk = dexR.status === "fulfilled";
  let market: TokenIntel["market"] = null;
  if (dexOk) {
    const allPairs =
      (dexR.value as { pairs?: Array<Record<string, unknown>> }).pairs ?? [];
    // priceUsd/volume on a DexScreener pair describe its BASE token. Keep
    // only pairs where OUR token is the base side; a deep-liquidity token
    // that only appears as the quote side (common for stables) still counts
    // as having a market.
    const pairs = allPairs.filter(
      (p) =>
        ((p.baseToken as Record<string, string> | undefined)?.address ?? "")
          .toLowerCase() === addr,
    );
    if (allPairs.length > 0 && pairs.length === 0) {
      market = {
        priceUsd: null,
        liquidityUsd: null,
        volume24hUsd: null,
        priceChange24hPct: null,
      };
      signals.push(
        "Trades only as the quote side of pairs (typical for stablecoins); price not derived",
      );
    } else if (pairs.length === 0) {
      high++;
      signals.push(
        "No market anywhere DexScreener indexes — there is no exit from this position",
      );
    } else {
      const best = pairs
        .map((p) => ({
          priceUsd: (p.priceUsd as string) ?? null,
          liquidityUsd:
            ((p.liquidity as Record<string, number> | undefined)?.usd as number) ??
            0,
          volume24hUsd:
            ((p.volume as Record<string, number> | undefined)?.h24 as number) ??
            null,
          priceChange24hPct:
            ((p.priceChange as Record<string, number> | undefined)
              ?.h24 as number) ?? null,
        }))
        .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
      market = best;
      if ((best.liquidityUsd ?? 0) < 5_000) {
        high++;
        signals.push(
          `Deepest pool holds only $${Math.round(best.liquidityUsd ?? 0).toLocaleString()} — exiting any real position moves the price against you`,
        );
      } else if ((best.liquidityUsd ?? 0) < 50_000) {
        caution++;
        signals.push(
          `Thin liquidity: $${Math.round(best.liquidityUsd ?? 0).toLocaleString()} in the deepest pool`,
        );
      }
    }
  }

  // ---- Honeypot.is ----------------------------------------------------------
  const honeyOk = honeyR.status === "fulfilled";
  if (honeyOk) {
    const h = honeyR.value as {
      honeypotResult?: { isHoneypot?: boolean };
      summary?: { risk?: string };
    };
    if (h.honeypotResult?.isHoneypot === true) {
      high++;
      signals.push("Honeypot.is simulation: a buy could NOT be sold back");
    } else if (h.summary?.risk && ["high", "very_high"].includes(h.summary.risk)) {
      caution++;
      signals.push(`Honeypot.is rates behavioural risk "${h.summary.risk}"`);
    }
  }

  // ---- verdict --------------------------------------------------------------
  const answered = [goplusOk, dexOk, honeyOk].filter(Boolean).length;
  const verdict: TokenIntel["verdict"] =
    answered < 2
      ? "insufficient-data"
      : high > 0
        ? "high-risk"
        : caution > 0
          ? "caution"
          : "no-major-flags";

  if (answered < 2) {
    signals.push(
      `Only ${answered}/3 risk sources answered — refusing to call this safe on one opinion`,
    );
  }

  const trend =
    trendR.status === "fulfilled" &&
    (trendR.value.change7dPct != null || trendR.value.change30dPct != null)
      ? trendR.value
      : undefined;

  const intel: TokenIntel = {
    address: addr,
    chain,
    token: { name, symbol, decimals },
    sources: { goplus: goplusOk, dexscreener: dexOk, honeypot: honeyOk },
    market,
    signals,
    verdict,
    ...(trend ? { trend } : {}),
    checkedAt: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), intel });
  return intel;
}
