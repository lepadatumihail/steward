"use client";

import { sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import { shortAddress } from "@/lib/steward/format";
import type { TokenIntel } from "@/lib/steward/types";

const VERDICT_STYLES: Record<TokenIntel["verdict"], { badge: string; label: string }> = {
  "high-risk": {
    badge: "border-red-900 bg-red-950/40 text-red-300",
    label: "high risk",
  },
  caution: {
    badge: "border-yellow-900 bg-yellow-950/30 text-yellow-300",
    label: "caution",
  },
  "no-major-flags": {
    badge: "border-emerald-900 bg-emerald-950/30 text-emerald-300",
    label: "no major flags",
  },
  "insufficient-data": {
    badge: "border-neutral-700 bg-neutral-900/40 text-neutral-400",
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
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-300">
            Token intel: {symbol.safe || "(unnamed)"}
            <span className="ml-2 font-normal text-neutral-600">
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
          className="text-xs text-neutral-600 hover:text-neutral-400"
        >
          dismiss
        </button>
      </div>

      {intel.market && (
        <p className="mt-2 text-xs text-neutral-500">
          {intel.market.priceUsd ? `$${intel.market.priceUsd}` : "price n/a"}
          {" · "}deepest pool {money(intel.market.liquidityUsd)}
          {" · "}24h volume {money(intel.market.volume24hUsd)}
          {intel.market.priceChange24hPct != null && (
            <>
              {" · "}
              <span
                className={
                  intel.market.priceChange24hPct < 0
                    ? "text-red-400"
                    : "text-emerald-400"
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
            <li key={s} className="text-xs leading-relaxed text-neutral-400">
              · {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          No risk signals from any source.
        </p>
      )}

      <p className="mt-3 text-[11px] text-neutral-600">
        {sourceCount}/3 independent sources answered (GoPlus, DexScreener,
        Honeypot.is). Security signals, not financial advice.
      </p>
    </section>
  );
}
