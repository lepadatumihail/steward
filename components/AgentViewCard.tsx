"use client";

import type { ToolResult } from "@/lib/webmcp/types";

/** One ⟦UNTRUSTED:field⟧…⟦/UNTRUSTED⟧ span, or a run of plain text between them. */
const FENCE = /(⟦UNTRUSTED:[^⟧]*⟧[\s\S]*?⟦\/UNTRUSTED⟧)/g;

function FencedText({ text }: { text: string }) {
  const parts = text.split(FENCE);
  return (
    <>
      {parts.map((part, i) =>
        FENCE.test(part) ? (
          <mark
            key={i}
            className="rounded bg-red-100 px-0.5 text-red-800 ring-1 ring-red-300"
            title="Attacker-controlled on-chain text, fenced so the agent reads it as data"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * The agent's side of the glass: the exact envelope a tool just returned,
 * quarantine notice included, with every untrusted fence highlighted.
 *
 * The dashboard already shows the human view of an approval. This card
 * exists so a person can see that what the AGENT received is fenced data,
 * not instructions, without opening DevTools.
 */
export function AgentViewCard({
  tool,
  output,
  onDismiss,
}: {
  tool: string;
  output: ToolResult;
  onDismiss: () => void;
}) {
  const fences = output.content.reduce(
    (n, part) => n + (part.text.match(FENCE)?.length ?? 0),
    0,
  );

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-neutral-900">
          Agent view
          <span className="ml-2 font-normal text-neutral-500">
            exactly what <code className="text-xs">{tool}</code> returned
            {output.isError ? " · error" : ""}
            {fences > 0 ? ` · ${fences} fenced span${fences === 1 ? "" : "s"}` : ""}
          </span>
        </h2>
        <button
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          dismiss
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {output.content.map((part, i) => (
          <pre
            key={i}
            className="whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[12px] leading-relaxed text-neutral-800"
          >
            <FencedText text={part.text} />
          </pre>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">
        Highlighted spans are on-chain text an attacker could have written.
        The fence characters are stripped from the input first, so a payload
        cannot close its own fence.
      </p>
    </section>
  );
}
