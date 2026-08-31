/**
 * Server-side chain clients, keyless by design.
 *
 * Endpoint choices are probe-verified (2026-09-01, wayfinder/assets/
 * T15-reverification-sep01.md), not doc-derived:
 *  - mainnet: eth.drpc.org and ethereum-rpc.publicnode.com both healthy.
 *  - base: mainnet.base.org now serves 10,000-block getLogs ranges and
 *    survived a 30-call burst; base.drpc.org matches. base.blockscout.com is
 *    NOT used anywhere: 10-request budget with a ~42-minute lockout.
 *
 * `fallback` rotates to the next transport on failure, which matters because
 * none of these carry an SLA.
 */

import { createPublicClient, fallback, http } from "viem";
import { base, mainnet } from "viem/chains";

const opts = { retryCount: 2, timeout: 15_000 } as const;

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://eth.drpc.org", opts),
    http("https://ethereum-rpc.publicnode.com", opts),
  ]),
});

export const baseClient = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org", opts),
    http("https://base-rpc.publicnode.com", opts),
    http("https://base.drpc.org", opts),
  ]),
});

export function clientFor(chain: "ethereum" | "base") {
  return chain === "ethereum" ? mainnetClient : baseClient;
}
