"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, isAddress } from "viem";
import { useStewardTool } from "@/lib/webmcp/useStewardTool";
import {
  getModelContextMode,
  installShim,
  type ModelContextMode,
} from "@/lib/webmcp/shim";
import { quarantine, sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import { DEMO_ADDRESS, DEMO_APPROVALS } from "@/lib/steward/fixtures";
import { assessApproval } from "@/lib/steward/risk";
import {
  formatApprovalDetail,
  formatApprovalsForAgent,
  shortAddress,
} from "@/lib/steward/format";
import type { AssessedApproval, StagedAction } from "@/lib/steward/types";
import { ApprovalCard } from "./ApprovalCard";
import { StagedActionCard } from "./StagedActionCard";
import { ToolStatusPanel } from "./ToolStatusPanel";

// Runs once on the client, before any component effect, so tools always have a
// registry to register into. No-ops when the browser has a native model context.
if (typeof document !== "undefined") installShim();

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function StewardApp() {
  const [address, setAddress] = useState(DEMO_ADDRESS);
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<StagedAction[]>([]);
  // Read after mount: the server has no model context, so reading during render
  // would produce a hydration mismatch.
  const [contextMode, setContextMode] = useState<ModelContextMode>("none");
  useEffect(() => setContextMode(getModelContextMode()), []);

  // Watch-only by design: any pasted address is auditable with no wallet.
  const approvals: AssessedApproval[] = useMemo(
    () => DEMO_APPROVALS.map((a) => ({ ...a, risk: assessApproval(a) })),
    [],
  );

  const findApproval = useCallback(
    (id: string) =>
      approvals.find(
        (a) => a.id === id || a.id.toLowerCase() === id.toLowerCase(),
      ),
    [approvals],
  );

  const stageRevoke = useCallback(
    (approval: AssessedApproval): StagedAction => {
      const action: StagedAction = {
        id: `revoke-${approval.id}-${staged.length}`,
        kind: "revoke",
        chain: approval.chain,
        to: approval.token.address,
        data: encodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [approval.spender.address as `0x${string}`, 0n],
        }),
        // The symbol is attacker-chosen: sanitise before it reaches the UI,
        // the agent, or the wallet-confirmation text.
        summary: `Set allowance to 0 for ${approval.spender.knownProtocol ?? shortAddress(approval.spender.address)} on ${sanitizeUntrusted(approval.token.symbol, 16).safe}`,
        approvalId: approval.id,
        createdAt: new Date().toISOString(),
      };
      setStaged((prev) =>
        prev.some((s) => s.approvalId === approval.id) ? prev : [...prev, action],
      );
      return action;
    },
    [staged.length],
  );

  // ---- WebMCP tool surface -------------------------------------------------

  const scanTool = useStewardTool<{ address?: string }>({
    name: "scan_approvals",
    description:
      "Audit every live ERC-20 token approval for a wallet address and score each one for risk. Works for any address without connecting a wallet. Returns the worst approvals first.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "The wallet address to audit. Defaults to the address currently shown in Steward.",
        },
      },
    },
    // Read-only, and it carries token names the token itself chose.
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: ({ address: requested }) => {
      const target = requested?.trim() || address;
      if (requested && !isAddress(requested.trim())) {
        throw new Error(
          `"${requested}" is not a valid Ethereum address. Provide a 0x-prefixed 40-hex-character address.`,
        );
      }
      return formatApprovalsForAgent(target, approvals);
    },
  });

  const explainTool = useStewardTool<{ approval_id: string }>({
    name: "explain_approval",
    description:
      "Explain one approval in full: which contract can spend what, how much is at risk, how old it is, and every reason behind its risk score.",
    inputSchema: {
      type: "object",
      properties: {
        approval_id: {
          type: "string",
          description: "The id from scan_approvals, e.g. ethereum:0xa0b8...:0x68b3...",
        },
      },
      required: ["approval_id"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: ({ approval_id }) => {
      const found = findApproval(approval_id);
      if (!found) {
        throw new Error(
          `No approval with id "${approval_id}". Call scan_approvals first and use an id from its output.`,
        );
      }
      return formatApprovalDetail(found);
    },
  });

  const revokeTool = useStewardTool<{ approval_id: string }>({
    name: "stage_revoke",
    description:
      "Prepare a revocation for one approval and place it in Steward's review queue. This does NOT revoke anything: the user must review and sign it in their own wallet. Returns the staged action for confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        approval_id: {
          type: "string",
          description: "The id of the approval to revoke, from scan_approvals.",
        },
      },
      required: ["approval_id"],
    },
    // Deliberately NOT readOnlyHint: this stages state the user must act on.
    // It still echoes a token symbol, so it carries untrusted content as well.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: ({ approval_id }) => {
      const found = findApproval(approval_id);
      if (!found) {
        throw new Error(
          `No approval with id "${approval_id}". Call scan_approvals first.`,
        );
      }
      const action = stageRevoke(found);
      const sym = quarantine("token.symbol", found.token.symbol, 24).text;
      return (
        `awaiting_user_confirmation\n` +
        `Staged a revoke for ${sym} -> ${found.spender.knownProtocol ?? shortAddress(found.spender.address)}.\n` +
        `${action.summary}\n` +
        `It is now in Steward's review queue. The user must confirm and sign it in their wallet. ` +
        `You cannot complete this action, and neither can this page.`
      );
    },
  });

  const tools = [
    { label: "scan_approvals", state: scanTool },
    { label: "explain_approval", state: explainTool },
    { label: "stage_revoke", state: revokeTool },
  ];

  const worst = approvals.reduce(
    (acc, a) => (a.risk.score > acc ? a.risk.score : acc),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Steward
            <span className="ml-3 text-sm font-normal text-neutral-400">
              wallet safety, agent-readable
            </span>
          </h1>
          <a
            href="https://github.com"
            className="text-xs text-neutral-500 underline-offset-4 hover:underline"
          >
            open source
          </a>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Steward audits the token approvals a wallet has handed out, scores what
          each one puts at risk, and stages revokes for you to sign. An agent in
          your browser can drive all of it — but it can never sign anything. Only
          your wallet can do that.
        </p>
      </header>

      <form
        className="mb-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          if (isAddress(next)) setAddress(next);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Audit any address — no wallet needed (${shortAddress(DEMO_ADDRESS)})`}
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          type="submit"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-900"
        >
          Audit
        </button>
      </form>

      <ToolStatusPanel tools={tools} mode={contextMode} />

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-300">
            Approvals for {shortAddress(address)}
          </h2>
          <span className="text-xs text-neutral-500">
            {approvals.length} live · worst score {worst}
          </span>
        </div>
        <div className="space-y-3">
          {[...approvals]
            .sort((a, b) => b.risk.score - a.risk.score)
            .map((a) => (
              <ApprovalCard
                key={a.id}
                approval={a}
                staged={staged.some((s) => s.approvalId === a.id)}
                onStage={() => stageRevoke(a)}
              />
            ))}
        </div>
      </section>

      {staged.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-neutral-300">
            Review queue — {staged.length} staged, none signed
          </h2>
          <div className="space-y-3">
            {staged.map((s) => (
              <StagedActionCard
                key={s.id}
                action={s}
                onDiscard={() =>
                  setStaged((prev) => prev.filter((x) => x.id !== s.id))
                }
              />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-16 border-t border-neutral-900 pt-6 text-xs leading-relaxed text-neutral-600">
        Steward never holds keys and never sends a transaction. Token names are
        attacker-controlled and are quarantined before any agent sees them.
      </footer>
    </div>
  );
}
