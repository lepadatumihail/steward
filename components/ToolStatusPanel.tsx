"use client";

import type { ModelContextMode } from "@/lib/webmcp/shim";
import type { UseStewardToolState } from "@/lib/webmcp/useStewardTool";

/**
 * Live WebMCP registration state.
 *
 * Doubles as the demo instrument: in the video this panel is how a viewer sees
 * that tools really registered and that the agent really called them.
 *
 * It distinguishes a real browser model context from Steward's own fallback
 * shim, because claiming agent support that is not there would be a lie told
 * to the one audience least able to check it.
 */

const MODE_COPY: Record<
  ModelContextMode,
  { dot: string; title: string; blurb: string | null }
> = {
  native: {
    dot: "bg-emerald-400",
    title: "WebMCP connected",
    blurb: null,
  },
  shim: {
    dot: "bg-amber-400",
    title: "WebMCP fallback (no agent present)",
    blurb:
      "This browser has no model context, so Steward registered its tools into its own local registry. You can inspect and run them by hand, but nothing is driving them. For the real thing, open Steward in the ChatGPT desktop browser, or in Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled.",
  },
  none: {
    dot: "bg-neutral-600",
    title: "WebMCP not available here",
    blurb:
      "Everything below still works — Steward is a normal web app first. To let an agent drive it, open this page in the ChatGPT desktop browser, or in Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled.",
  },
};

export function ToolStatusPanel({
  tools,
  mode,
}: {
  tools: { label: string; state: UseStewardToolState }[];
  mode: ModelContextMode;
}) {
  const registered = tools.filter((t) => t.state.registered).length;
  const invocations = tools.reduce((n, t) => n + t.state.invocations, 0);
  const copy = MODE_COPY[mode];

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${copy.dot}`} aria-hidden />
          <h2 className="text-sm font-medium text-neutral-300">{copy.title}</h2>
        </div>
        <p className="text-xs text-neutral-500">
          {registered}/{tools.length} tools registered · {invocations} tool
          call{invocations === 1 ? "" : "s"} this session
        </p>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {tools.map(({ label, state }) => (
          <li
            key={label}
            className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-neutral-300">{label}</code>
              <span
                className={`text-[10px] uppercase tracking-wide ${
                  state.registered ? "text-emerald-400" : "text-neutral-600"
                }`}
              >
                {state.registered ? "live" : "idle"}
              </span>
            </div>
            {state.invocations > 0 && (
              <p className="mt-1 text-[11px] text-neutral-500">
                called {state.invocations}×
              </p>
            )}
            {state.error && (
              <p className="mt-1 text-[11px] text-red-400">
                {state.error.message}
              </p>
            )}
          </li>
        ))}
      </ul>

      {copy.blurb && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          {copy.blurb}
        </p>
      )}
    </section>
  );
}
