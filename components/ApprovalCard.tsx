"use client";

import { sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import { formatAmount, shortAddress } from "@/lib/steward/format";
import type { AssessedApproval, RiskLevel } from "@/lib/steward/types";

const LEVEL_STYLES: Record<RiskLevel, string> = {
  critical: "border-red-300 bg-red-50 text-red-700",
  high: "border-orange-300 bg-orange-50 text-orange-700",
  medium: "border-yellow-400 bg-yellow-50 text-yellow-800",
  low: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

export function ApprovalCard({
  approval,
  staged,
  onStage,
}: {
  approval: AssessedApproval;
  staged: boolean;
  onStage: () => void;
}) {
  // The UI is a consumer of untrusted data too — never render a raw token name.
  const symbol = sanitizeUntrusted(approval.token.symbol, 16);
  const name = sanitizeUntrusted(approval.token.name, 140);
  const hostile = approval.risk.metadataFlags.length > 0;

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{symbol.safe || "(unnamed)"}</span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${LEVEL_STYLES[approval.risk.level]}`}
            >
              {approval.risk.level} {approval.risk.score}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-neutral-600">
            {approval.isUnlimited ? (
              <span className="text-orange-700">Unlimited allowance</span>
            ) : (
              `Allowance ${formatAmount(approval.allowanceRaw, approval.token.decimals)}`
            )}
            {" · "}
            {formatAmount(approval.exposureRaw, approval.token.decimals)}{" "}
            {symbol.safe} at risk
            {" · "}approved {approval.approvedAt.slice(0, 10)}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Spender:{" "}
            {approval.spender.knownProtocol ? (
              <span className="text-neutral-700">
                {approval.spender.knownProtocol}
              </span>
            ) : (
              <span className="text-orange-700">
                unverified {shortAddress(approval.spender.address)}
              </span>
            )}
          </p>
        </div>

        <button
          onClick={onStage}
          disabled={staged}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-neutral-100 disabled:hover:bg-transparent"
        >
          {staged ? "Staged" : "Stage revoke"}
        </button>
      </div>

      {hostile && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
            Quarantined — this token&apos;s metadata tried to talk to your agent
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-red-800/80">
            {name.safe}
          </p>
          <p className="mt-2 text-[11px] text-red-700/90">
            Flags: {approval.risk.metadataFlags.join(", ")}. Shown as data.
            Steward fences this before any agent reads it.
          </p>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-900">
          Why this score
        </summary>
        <ul className="mt-2 space-y-1">
          {approval.risk.reasons.map((r) => (
            <li key={r} className="text-xs leading-relaxed text-neutral-700">
              · {r}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
