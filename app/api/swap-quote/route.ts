/**
 * GET /api/swap-quote?chain=&tokenIn=&tokenOut=&amount=&sender=
 *
 * Quotes are time-sensitive: never CDN-cached. Server-side so the keyless
 * aggregator sees one client, and so the pinned-router check and the token
 * intel gate cannot be skipped by any caller — agent, UI, or curl.
 */

import { isAddress } from "viem";
import { getSwapQuote } from "@/lib/server/swap";
import type { ChainId } from "@/lib/steward/types";

export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const chainParam = q.get("chain") ?? "base";
  const tokenIn = (q.get("tokenIn") ?? "").trim();
  const tokenOut = (q.get("tokenOut") ?? "").trim();
  const amount = (q.get("amount") ?? "").trim();
  const sender = (q.get("sender") ?? "").trim() || undefined;

  if (chainParam !== "ethereum" && chainParam !== "base") {
    return err(400, `Unknown chain "${chainParam}". Use "ethereum" or "base".`);
  }
  const okToken = (t: string) => /^(eth|native)$/i.test(t) || isAddress(t);
  if (!okToken(tokenIn)) return err(400, `tokenIn must be "ETH" or a 0x… token address.`);
  if (!okToken(tokenOut)) return err(400, `tokenOut must be "ETH" or a 0x… token address.`);
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    return err(400, `amount must be a positive decimal string, e.g. "0.05".`);
  }
  if (sender && !isAddress(sender)) return err(400, "sender must be a 0x… address.");

  try {
    const quote = await getSwapQuote({
      chain: chainParam as ChainId,
      tokenIn,
      tokenOut,
      amount,
      sender,
    });
    return new Response(JSON.stringify(quote), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err(502, `Swap quote unavailable: ${message}`);
  }
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
