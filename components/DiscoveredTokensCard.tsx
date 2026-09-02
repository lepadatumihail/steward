"use client";

import { sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import {
  formatPriceUsd,
  shortAddress,
  type DiscoveredRow,
} from "@/lib/steward/format";

function money(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

/**
 * What the agent just saw from `discover_tokens`, for the human.
 *
 * Symbols are attacker-controlled on-chain text, so they pass through the
 * same sanitiser as everything else before they reach the DOM. The card says
 * plainly what the tool output says: market facts, not endorsements.
 */
export function DiscoveredTokensCard({
  chain,
  rows,
  onDismiss,
}: {
  chain: string;
  rows: DiscoveredRow[];
  onDismiss: () => void;
}) {
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-neutral-900">
          Market movers on {chain}
          <span className="ml-2 font-normal text-neutral-500">
            top {rows.length} by 24h volume
          </span>
        </h2>
        <button
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          dismiss
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-600">
          Nothing on {chain} clears the discovery floors right now.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="pb-2 pr-3 font-medium">Token</th>
                <th className="pb-2 pr-3 font-medium">Price</th>
                <th className="pb-2 pr-3 font-medium">24h</th>
                <th className="pb-2 pr-3 font-medium">Volume</th>
                <th className="pb-2 pr-3 font-medium">Liquidity</th>
                <th className="pb-2 pr-3 font-medium">Holders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const symbol = sanitizeUntrusted(r.symbol, 16);
                const change = r.change24Pct;
                return (
                  <tr key={r.address} className="border-t border-neutral-100">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-neutral-900">
                        {symbol.safe || "(unnamed)"}
                      </span>
                      <span className="ml-2 text-neutral-500">
                        {shortAddress(r.address)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-700">
                      {r.priceUsd == null ? "—" : `$${formatPriceUsd(r.priceUsd)}`}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums ${
                        change == null
                          ? "text-neutral-500"
                          : change < 0
                            ? "text-red-600"
                            : "text-emerald-700"
                      }`}
                    >
                      {change == null
                        ? "—"
                        : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-700">
                      {money(r.volume24Usd)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-700">
                      {money(r.liquidityUsd)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-neutral-700">
                      {r.holders == null ? "—" : r.holders.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-500">
        Market facts, not endorsements. Symbols are on-chain text and were
        sanitised before display. The agent vets a candidate with assess_token
        before it can be swapped.
      </p>
    </section>
  );
}
