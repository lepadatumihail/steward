/**
 * GET /api/discover?chain=ethereum|base&limit=8
 *
 * Volume-ranked market movers from Codex — Steward's only keyed source,
 * server-side so the key never reaches a browser. Failure degrades to one
 * honest error; nothing else in the app depends on this route.
 */

import { discoverTokens } from "@/lib/server/codex";
import type { ChainId } from "@/lib/steward/types";

export const maxDuration = 15;

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const chainParam = q.get("chain") ?? "base";
  const limit = parseInt(q.get("limit") ?? "8", 10) || 8;

  if (chainParam !== "ethereum" && chainParam !== "base") {
    return err(400, `Unknown chain "${chainParam}". Use "ethereum" or "base".`);
  }

  try {
    const tokens = await discoverTokens(chainParam as ChainId, limit);
    return new Response(
      JSON.stringify({ chain: chainParam, tokens, at: new Date().toISOString() }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err(502, `Discovery unavailable: ${message}`);
  }
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
