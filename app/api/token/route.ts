/**
 * GET /api/token?address=0x…&chain=ethereum|base
 *
 * Cross-source token risk intelligence. Server-side so the keyless sources'
 * rate budgets are spent once per token per 5 minutes, not once per visitor.
 */

import { isAddress } from "viem";
import { assessToken } from "@/lib/server/token-intel";
import type { ChainId } from "@/lib/steward/types";

export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  const chainParam = url.searchParams.get("chain") ?? "ethereum";

  if (chainParam !== "ethereum" && chainParam !== "base") {
    return err(400, `Unknown chain "${chainParam}". Use "ethereum" or "base".`);
  }
  if (!isAddress(address)) {
    return err(400, `"${address}" is not a valid token contract address.`);
  }

  try {
    const intel = await assessToken(address, chainParam as ChainId);
    return new Response(JSON.stringify(intel), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err(502, `Token assessment unavailable: ${message}`);
  }
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
