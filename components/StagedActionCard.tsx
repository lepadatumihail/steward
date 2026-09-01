"use client";

import { useConnection, useSendTransaction, useSwitchChain } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import type { StagedAction } from "@/lib/steward/types";
import { shortAddress } from "@/lib/steward/format";

/**
 * The consent surface.
 *
 * An agent can put an action here. Nothing executes until the human presses
 * the button and their wallet asks them to sign. That gap is the whole product:
 * the page cannot close it, the agent cannot close it, and the calldata shown
 * is byte-for-byte what the wallet will be asked to sign.
 */
export function StagedActionCard({
  action,
  onDiscard,
}: {
  action: StagedAction;
  onDiscard: () => void;
}) {
  const connection = useConnection();
  const { switchChain, isPending: switching } = useSwitchChain();
  const {
    sendTransaction,
    data: txHash,
    isPending: signing,
    error: txError,
  } = useSendTransaction();

  const targetChain = action.chain === "ethereum" ? mainnet : base;
  const onTargetChain = connection.chainId === targetChain.id;
  const explorer =
    action.chain === "ethereum"
      ? `https://etherscan.io/tx/${txHash}`
      : `https://basescan.org/tx/${txHash}`;

  return (
    <article className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            {txHash ? "Signed · submitted" : "Staged · not signed"}
          </p>
          <p className="mt-1 text-sm">{action.summary}</p>
          <p className="mt-1 text-xs text-neutral-600">
            {action.data
              ? `Calls ${shortAddress(action.to)} on ${action.chain}`
              : `Sends native ETH to ${shortAddress(action.to)} on ${action.chain}`}
          </p>
          {action.meta?.map((line) => (
            <p key={line} className="mt-0.5 text-xs text-neutral-600">
              · {line}
            </p>
          ))}

          {txHash ? (
            <p className="mt-2 text-xs">
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline-offset-4 hover:underline"
              >
                {shortAddress(txHash)} — view on{" "}
                {action.chain === "ethereum" ? "Etherscan" : "Basescan"}
              </a>
            </p>
          ) : (
            action.data && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-900">
                  Exact calldata your wallet will be asked to sign
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-100 p-2 font-mono text-[10px] leading-relaxed text-neutral-700">
                  {action.data}
                </pre>
              </details>
            )
          )}

          {txError && (
            <p className="mt-2 text-xs text-red-600">
              {txError.message.split("\n")[0].slice(0, 160)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {!txHash && (
            <button
              onClick={onDiscard}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
            >
              Discard
            </button>
          )}
          {txHash ? (
            <button
              onClick={onDiscard}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
            >
              Done
            </button>
          ) : !connection.isConnected ? (
            <button
              disabled
              title="Connect a wallet (top right) to sign"
              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 opacity-50"
            >
              Sign in wallet
            </button>
          ) : !onTargetChain ? (
            <button
              onClick={() => switchChain({ chainId: targetChain.id })}
              disabled={switching}
              className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
            >
              {switching ? "Switching…" : `Switch to ${targetChain.name}`}
            </button>
          ) : (
            <button
              onClick={() =>
                sendTransaction({
                  to: action.to as `0x${string}`,
                  data: action.data as `0x${string}` | undefined,
                  value: action.valueWei ? BigInt(action.valueWei) : undefined,
                  chainId: targetChain.id,
                })
              }
              disabled={signing}
              className="rounded-lg border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {signing ? "Check your wallet…" : "Sign in wallet"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
