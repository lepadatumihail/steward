/**
 * GET /api/scan?address=0x…|name.eth&chain=ethereum|base
 *
 * The live pipeline, server-side on purpose: browser-direct calls to the data
 * sources would burn their keyless rate budgets once per visitor, and the
 * whole thing must keep working unattended while judging runs. Every failure
 * degrades to a JSON error the UI can render — never a hung request.
 */

import { isAddress } from "viem";
import { normalize } from "viem/ens";
import { mainnetClient } from "@/lib/server/chains";
import { scanAddress } from "@/lib/server/scan";
import type { ChainId } from "@/lib/steward/types";

export const maxDuration = 60; // a cold busy-wallet scan runs 15-25s

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawAddress = (url.searchParams.get("address") ?? "").trim();
  const chainParam = url.searchParams.get("chain") ?? "ethereum";

  if (chainParam !== "ethereum" && chainParam !== "base") {
    return err(400, `Unknown chain "${chainParam}". Use "ethereum" or "base".`);
  }
  const chain = chainParam as ChainId;

  let address = rawAddress;
  if (!isAddress(address)) {
    // ENS is resolved on mainnet regardless of the scan chain.
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(rawAddress)) {
      try {
        const resolved = await mainnetClient.getEnsAddress({
          name: normalize(rawAddress),
        });
        if (!resolved) return err(404, `ENS name "${rawAddress}" does not resolve.`);
        address = resolved;
      } catch {
        return err(502, "ENS resolution failed; paste the 0x address instead.");
      }
    } else {
      return err(
        400,
        `"${rawAddress}" is not a valid address. Provide 0x… or an ENS name.`,
      );
    }
  }

  try {
    const result = await scanAddress(address, chain);
    return new Response(JSON.stringify({ address, ...result }), {
      headers: {
        "content-type": "application/json",
        // CDN-cacheable: repeat judge clicks and agent calls hit the edge.
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err(502, `Live scan unavailable: ${message}`);
  }
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
