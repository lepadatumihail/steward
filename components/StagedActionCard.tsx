"use client";

import type { StagedAction } from "@/lib/steward/types";
import { shortAddress } from "@/lib/steward/format";

/**
 * The consent surface.
 *
 * An agent can put an action here. Nothing here executes until the human presses
 * the button and their wallet asks them to sign. That gap is the whole product:
 * the page cannot close it, and neither can the agent.
 */
export function StagedActionCard({
  action,
  onDiscard,
}: {
  action: StagedAction;
  onDiscard: () => void;
}) {
  return (
    <article className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Staged · not signed
          </p>
          <p className="mt-1 text-sm">{action.summary}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Calls {shortAddress(action.to)} on {action.chain}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
              Exact calldata your wallet will be asked to sign
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-950 p-2 font-mono text-[10px] leading-relaxed text-neutral-400">
              {action.data}
            </pre>
          </details>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={onDiscard}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-900"
          >
            Discard
          </button>
          <button
            disabled
            title="Connect a wallet to sign"
            className="rounded-lg border border-amber-700/60 bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-200 disabled:opacity-50"
          >
            Sign in wallet
          </button>
        </div>
      </div>
    </article>
  );
}
