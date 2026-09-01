/**
 * Swap quoting for `stage_swap` — the trading verb, WebMCP-first.
 *
 * Design rules, in order of importance:
 *
 *  1. ZERO DELEGATION. This module produces a quote and calldata. Nothing
 *     here — and nothing in the tool that calls it — can execute a swap. The
 *     calldata dies in the review queue until the user's wallet signs it.
 *
 *  2. THE PAGE ENFORCES THE SAFETY CHECK, NOT THE AGENT. Every quote for an
 *     ERC-20 output runs the token through Steward's cross-source intel
 *     (GoPlus + DexScreener + Honeypot.is). An agent cannot propose buying a
 *     honeypot without the warning being welded into the tool result.
 *
 *  3. PINNED ROUTER. KyberSwap's aggregator is keyless (probe-verified
 *     2026-09-01: routes GET + route/build POST with an x-client-id header,
 *     ~0.3s, mainnet + Base). We still never trust the API's routerAddress:
 *     if it is not the KyberSwap MetaAggregationRouterV2 this module refuses
 *     the quote. A compromised quote API must not be able to redirect a
 *     signature to an arbitrary contract.
 *
 *  4. EXACT-AMOUNT APPROVALS. When the input token needs an allowance, the
 *     staged approval is for the swap amount only — never unlimited. Steward
 *     exists because of unlimited approvals; it does not create them.
 */

import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";
import { assessToken } from "./token-intel";
import { clientFor } from "./chains";
import type { ChainId, TokenIntel } from "../steward/types";

/** KyberSwap MetaAggregationRouterV2 — same address on mainnet and Base. */
export const KYBER_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";

const KYBER_BASE: Record<ChainId, string> = {
  ethereum: "https://aggregator-api.kyberswap.com/ethereum/api/v1",
  base: "https://aggregator-api.kyberswap.com/base/api/v1",
};

/** Kyber's sentinel for native ETH. */
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "x-client-id": "steward-webmcp",
};

export interface SwapQuote {
  chain: ChainId;
  tokenIn: { address: string; symbol: string; decimals: number };
  /** isNative distinguishes "no token to vet" from "the vet failed". */
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
    isNative: boolean;
  };
  amountIn: string;
  amountOut: string;
  /** amountOut minus slippage tolerance (0.5%). */
  minReceived: string;
  amountInUsd: number | null;
  amountOutUsd: number | null;
  gasUsd: number | null;
  /** Present when tokenOut is an ERC-20: Steward's own risk verdict. */
  intel: Pick<TokenIntel, "verdict" | "signals"> | null;
  /** Present only when a sender was given (needed to build calldata). */
  tx: {
    needsApproval: boolean;
    /** Exact-amount approve calldata for the input token, if needed. */
    approve?: { to: string; data: string };
    swap: { to: string; data: string; valueWei: string };
  } | null;
}

function isNative(token: string): boolean {
  return /^(eth|native)$/i.test(token.trim()) || token.toLowerCase() === NATIVE.toLowerCase();
}

async function tokenMeta(
  chain: ChainId,
  token: string,
): Promise<{ address: string; symbol: string; decimals: number }> {
  if (isNative(token)) return { address: NATIVE, symbol: "ETH", decimals: 18 };
  const client = clientFor(chain);
  const [decimals, symbol] = await Promise.all([
    client.readContract({
      address: token as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    client
      .readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      })
      .catch(() => "???"),
  ]);
  return { address: token.toLowerCase(), symbol: String(symbol), decimals: Number(decimals) };
}

export async function getSwapQuote(opts: {
  chain: ChainId;
  tokenIn: string;
  tokenOut: string;
  /** Human units, e.g. "0.5". */
  amount: string;
  /** Wallet that would sign. Without it we quote but cannot build calldata. */
  sender?: string;
}): Promise<SwapQuote> {
  const { chain, sender } = opts;
  const [tin, tout] = await Promise.all([
    tokenMeta(chain, opts.tokenIn),
    tokenMeta(chain, opts.tokenOut),
  ]);
  if (tin.address === tout.address) {
    throw new Error("tokenIn and tokenOut are the same token.");
  }

  const amountIn = parseUnits(opts.amount as `${number}`, tin.decimals);
  if (amountIn <= 0n) throw new Error("amount must be positive.");

  // ---- quote + intel in parallel; the intel is non-negotiable -------------
  const routesUrl =
    `${KYBER_BASE[chain]}/routes?tokenIn=${tin.address}` +
    `&tokenOut=${tout.address}&amountIn=${amountIn.toString()}`;
  const [routesRes, intel] = await Promise.all([
    fetch(routesUrl, { headers: HEADERS, signal: AbortSignal.timeout(12_000) }),
    tout.address === NATIVE
      ? Promise.resolve(null)
      : assessToken(tout.address, chain).catch(() => null),
  ]);
  if (!routesRes.ok) {
    const body = (await routesRes.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      body?.message
        ? `aggregator: ${body.message}`
        : `quote API HTTP ${routesRes.status} (often: no route exists for this pair)`,
    );
  }
  const routes = (await routesRes.json()) as {
    code?: number;
    message?: string;
    data?: { routeSummary?: Record<string, unknown>; routerAddress?: string };
  };
  if (routes.code !== 0 || !routes.data?.routeSummary) {
    throw new Error(
      `no route: ${routes.message ?? "the aggregator found no path for this pair"}`,
    );
  }
  if (
    (routes.data.routerAddress ?? "").toLowerCase() !== KYBER_ROUTER.toLowerCase()
  ) {
    // Defense against a compromised or impersonated quote API.
    throw new Error("quote refused: router address does not match the pinned KyberSwap router");
  }

  const rs = routes.data.routeSummary as {
    amountOut?: string;
    amountInUsd?: string;
    amountOutUsd?: string;
    gasUsd?: string;
  };
  const amountOut = BigInt(rs.amountOut ?? "0");
  const minReceived = (amountOut * 995n) / 1000n; // 0.5% slippage tolerance

  // ---- calldata, only when we know who signs -------------------------------
  let tx: SwapQuote["tx"] = null;
  if (sender) {
    const buildRes = await fetch(`${KYBER_BASE[chain]}/route/build`, {
      method: "POST",
      headers: HEADERS,
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        routeSummary: routes.data.routeSummary,
        sender,
        recipient: sender,
        slippageTolerance: 50, // bps
      }),
    });
    if (!buildRes.ok) {
      const body = (await buildRes.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(
        body?.message ? `aggregator: ${body.message}` : `build API HTTP ${buildRes.status}`,
      );
    }
    const build = (await buildRes.json()) as {
      code?: number;
      message?: string;
      data?: { data?: string; routerAddress?: string; transactionValue?: string };
    };
    if (build.code !== 0 || !build.data?.data) {
      throw new Error(`calldata build failed: ${build.message ?? "unknown"}`);
    }
    if (
      (build.data.routerAddress ?? "").toLowerCase() !== KYBER_ROUTER.toLowerCase()
    ) {
      throw new Error("build refused: router address does not match the pinned KyberSwap router");
    }

    let needsApproval = false;
    let approve: { to: string; data: string } | undefined;
    if (tin.address !== NATIVE) {
      const allowance = await clientFor(chain).readContract({
        address: tin.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [sender as `0x${string}`, KYBER_ROUTER as `0x${string}`],
      });
      if (allowance < amountIn) {
        needsApproval = true;
        approve = {
          to: tin.address,
          // EXACT amount, never unlimited — see module header.
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [KYBER_ROUTER as `0x${string}`, amountIn],
          }),
        };
      }
    }

    tx = {
      needsApproval,
      ...(approve ? { approve } : {}),
      swap: {
        to: KYBER_ROUTER,
        data: build.data.data,
        valueWei: tin.address === NATIVE ? amountIn.toString() : "0",
      },
    };
  }

  return {
    chain,
    tokenIn: tin,
    tokenOut: { ...tout, isNative: tout.address === NATIVE },
    amountIn: amountIn.toString(),
    amountOut: amountOut.toString(),
    minReceived: minReceived.toString(),
    amountInUsd: rs.amountInUsd ? parseFloat(rs.amountInUsd) : null,
    amountOutUsd: rs.amountOutUsd ? parseFloat(rs.amountOutUsd) : null,
    gasUsd: rs.gasUsd ? parseFloat(rs.gasUsd) : null,
    intel: intel ? { verdict: intel.verdict, signals: intel.signals.slice(0, 4) } : null,
    tx,
  };
}

/** Human-readable amount for a quote leg. */
export function fmtLeg(raw: string, decimals: number): string {
  try {
    const n = Number(formatUnits(BigInt(raw), decimals));
    return n < 0.0001 ? "<0.0001" : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  } catch {
    return "?";
  }
}
