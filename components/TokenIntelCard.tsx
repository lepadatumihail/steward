"use client";

import { sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import { shortAddress } from "@/lib/steward/format";
import type { TokenIntel } from "@/lib/steward/types";

const VERDICT_STYLES: Record<TokenIntel["verdict"], { badge: string; label: string }> = {
  "high-risk": {
    badge: "border-red-300 bg-red-50 text-red-700",
    label: "high risk",
  },
  caution: {
    badge: "border-yellow-400 bg-yellow-50 text-yellow-800",
    label: "caution",
  },
  "no-major-flags": {
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    label: "no major flags",
  },
  "insufficient-data": {
    badge: "border-neutral-300 bg-neutral-50 text-neutral-700",
    label: "insufficient data",
  },
};

function money(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** The trading-partner readout: what three independent sources say about one token. */
export function TokenIntelCard({
  intel,
  onDismiss,
}: {
  intel: TokenIntel;
  onDismiss: () => void;
}) {
  const symbol = sanitizeUntrusted(intel.token.symbol, 16);
  const style = VERDICT_STYLES[intel.verdict];
  const sourceCount = Object.values(intel.sources).filter(Boolean).length;

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-900">
            Token intel: {symbol.safe || "(unnamed)"}
            <span className="ml-2 font-normal text-neutral-500">
              {shortAddress(intel.address)} · {intel.chain}
            </span>
          </h2>
          <span
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${style.badge}`}
          >
            {style.label}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          dismiss
        </button>
      </div>

      {intel.market && (
        <p className="mt-2 text-xs text-neutral-600">
          {intel.market.priceUsd ? `$${intel.market.priceUsd}` : "price n/a"}
          {" · "}deepest pool {money(intel.market.liquidityUsd)}
          {" · "}24h volume {money(intel.market.volume24hUsd)}
          {intel.market.priceChange24hPct != null && (
            <>
              {" · "}
              <span
                className={
                  intel.market.priceChange24hPct < 0
                    ? "text-red-600"
                    : "text-emerald-700"
                }
              >
                {intel.market.priceChange24hPct > 0 ? "+" : ""}
                {intel.market.priceChange24hPct}% 24h
              </span>
            </>
          )}
        </p>
      )}

      {intel.signals.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {intel.signals.map((s) => (
            <li key={s} className="text-xs leading-relaxed text-neutral-700">
              · {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-neutral-600">
          No risk signals from any source.
        </p>
      )}

      <p className="mt-3 text-[11px] text-neutral-500">
        {sourceCount}/3 independent sources answered (GoPlus, DexScreener,
        Honeypot.is). Security signals, not financial advice.
      </p>
    </section>
  );
}
