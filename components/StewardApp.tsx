"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFunctionData, isAddress } from "viem";
import { ProviderNotFoundError,
  useConnect, useConnection, useDisconnect } from "wagmi";
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
  resolveApprovalId,
  shortAddress,
} from "@/lib/steward/format";
import type {
  AssessedApproval,
  ChainId,
  StagedAction,
} from "@/lib/steward/types";
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

const DEMO_ASSESSED: AssessedApproval[] = DEMO_APPROVALS.map((a) => ({
  ...a,
  risk: assessApproval(a),
}));

interface ScanState {
  status: "demo" | "loading" | "live" | "error";
  address: string;
  chain: ChainId;
  approvals: AssessedApproval[];
  /** Server meta for live scans; demo mode explains itself instead. */
  coverage?: string;
  totalCount?: number;
  error?: string;
}

const DEMO_STATE: ScanState = {
  status: "demo",
  address: DEMO_ADDRESS,
  chain: "ethereum",
  approvals: DEMO_ASSESSED,
  coverage: "deterministic demo fixture (includes a planted hostile token)",
  totalCount: DEMO_ASSESSED.length,
};

function looksLikeTarget(value: string): boolean {
  return isAddress(value) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(value);
}

export function StewardApp() {
  const [scan, setScan] = useState<ScanState>(DEMO_STATE);
  const [input, setInput] = useState("");
  const [chain, setChain] = useState<ChainId>("ethereum");
  const [staged, setStaged] = useState<StagedAction[]>([]);
  // Read after mount: the server has no model context, so reading during render
  // would produce a hydration mismatch.
  const [contextMode, setContextMode] = useState<ModelContextMode>("none");
  useEffect(() => setContextMode(getModelContextMode()), []);

  const connection = useConnection();
  const { connectors, connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  // Tools close over the latest scan through a ref, so an agent that scanned
  // one address and explains an approval a second later never reads stale state.
  const scanRef = useRef(scan);
  scanRef.current = scan;

  /**
   * One scan path for humans and agents. The demo address never touches the
   * network — it must keep working if every data source dies during judging.
   */
  const runScan = useCallback(
    async (target: string, targetChain: ChainId): Promise<ScanState> => {
      if (target.toLowerCase() === DEMO_ADDRESS.toLowerCase()) {
        scanRef.current = DEMO_STATE;
        setScan(DEMO_STATE);
        return DEMO_STATE;
      }
      setScan((prev) => ({ ...prev, status: "loading" }));
      try {
        const res = await fetch(
          `/api/scan?address=${encodeURIComponent(target)}&chain=${targetChain}`,
        );
        if (!res.ok) {
          // Platform-level failures (Vercel 504 on timeout) have plain-text
          // bodies; parsing first turns them into JSON stack-trace strings.
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: string } | null)?.error ??
              `scan failed (${res.status}) — try again in a minute`,
          );
        }
        const body = await res.json();
        const next: ScanState = {
          status: "live",
          address: body.address,
          chain: targetChain,
          approvals: body.approvals,
          coverage: body.meta.coverage,
          totalCount: body.meta.liveNonzero,
        };
        // Ref first, state second: agents chain tool calls faster than React
        // renders, and the next call must see THIS scan, not the previous one.
        scanRef.current = next;
        setScan(next);
        return next;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const next: ScanState = {
          ...scanRef.current,
          status: "error",
          error: message,
        };
        setScan(next);
        return next;
      }
    },
    [],
  );

  const findApproval = useCallback((id: string) => {
    return resolveApprovalId(id, scanRef.current.approvals);
  }, []);

  const stageRevoke = useCallback((approval: AssessedApproval): StagedAction => {
    const action: StagedAction = {
      id: `revoke-${approval.id}`,
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
  }, []);

  // ---- WebMCP tool surface -------------------------------------------------

  const scanTool = useStewardTool<{ address?: string; chain?: string }>({
    name: "scan_approvals",
    description:
      "Audit the live ERC-20 token approvals of any wallet address (0x… or ENS name) and score each one for risk. Live on-chain data, no wallet connection needed. Returns the worst approvals first and updates Steward's dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "Wallet to audit: a 0x address or ENS name. Omit to use the address currently shown in Steward.",
        },
        chain: {
          type: "string",
          description:
            'Which chain to scan: "Ethereum" (default, full history) or "Base" (recent history).',
        },
      },
    },
    // Read-only, and it carries token names the token itself chose.
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ address: requested, chain: chainArg }) => {
      const targetChain: ChainId =
        chainArg?.toLowerCase() === "base" ? "base" : "ethereum";
      const target = requested?.trim() || scanRef.current.address;
      if (requested && !looksLikeTarget(target)) {
        throw new Error(
          `"${requested}" is not a valid address. Provide a 0x-prefixed address or an ENS name like vitalik.eth.`,
        );
      }
      const result =
        target.toLowerCase() === scanRef.current.address.toLowerCase() &&
        scanRef.current.status !== "error"
          ? scanRef.current
          : await runScan(target, targetChain);
      if (result.status === "error") {
        throw new Error(result.error ?? "live scan unavailable");
      }
      return formatApprovalsForAgent(result.address, result.approvals, {
        totalCount: result.totalCount,
        coverage: result.coverage,
      });
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
          description: "The id from scan_approvals; the short form it prints (ethereum:0xabcd…ef12:0xabcd…ef12) is accepted as-is.",
        },
      },
      required: ["approval_id"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: ({ approval_id }) => {
      const found = findApproval(approval_id);
      if (!found) {
        throw new Error(
          `No approval with id "${approval_id}" in the current scan. Call scan_approvals first and use an id from its output.`,
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
          description: "The id of the approval to revoke, exactly as printed by scan_approvals.",
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
          `No approval with id "${approval_id}" in the current scan. Call scan_approvals first.`,
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

  const worst = scan.approvals.reduce(
    (acc, a) => (a.risk.score > acc ? a.risk.score : acc),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Steward
            <span className="ml-3 text-sm font-normal text-neutral-400">
              wallet safety, agent-readable
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/lepadatumihail/steward"
              className="text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              open source
            </a>
            {connection.isConnected ? (
              <button
                onClick={() => disconnect()}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-900"
                title="Disconnect wallet"
              >
                {shortAddress(connection.address ?? "")} ·{" "}
                <span className="text-neutral-500">disconnect</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const injectedConnector = connectors[0];
                  if (injectedConnector) connect({ connector: injectedConnector });
                }}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium hover:bg-neutral-900"
              >
                Connect wallet
              </button>
            )}
          </div>
        </div>
        {!connection.isConnected && connectError && (
          <p className="mt-2 text-xs text-amber-400/80">
            {connectError instanceof ProviderNotFoundError
              ? "No browser wallet found — Steward still works watch-only; a wallet is only needed to sign revokes."
              : connectError.message.split("\n")[0]}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Steward audits the token approvals a wallet has handed out, scores what
          each one puts at risk, and stages revokes for you to sign. An agent in
          your browser can drive all of it — but it can never sign anything. Only
          your wallet can do that.
        </p>
      </header>

      <form
        className="mb-8 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          if (looksLikeTarget(next)) void runScan(next, chain);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Audit any address or ENS name — no wallet needed (try vitalik.eth)"
          className="min-w-0 flex-1 basis-56 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as ChainId)}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm text-neutral-300"
          aria-label="Chain"
        >
          <option value="ethereum">Ethereum</option>
          <option value="base">Base</option>
        </select>
        <button
          type="submit"
          disabled={scan.status === "loading"}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-900 disabled:opacity-50"
        >
          {scan.status === "loading" ? "Scanning…" : "Audit"}
        </button>
      </form>

      <ToolStatusPanel tools={tools} mode={contextMode} />

      {scan.status === "error" && (
        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-300">
          Live scan unavailable: {scan.error}
          <span className="block pt-1 text-xs text-red-300/70">
            The demo address still works offline — every data source Steward uses
            is keyless public infrastructure, and sometimes it has a bad minute.
          </span>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-neutral-300">
            Approvals for {shortAddress(scan.address)}
            {scan.status === "demo" && (
              <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                demo data
              </span>
            )}
            {scan.status === "live" && (
              <span className="ml-2 rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                live · {scan.chain}
              </span>
            )}
          </h2>
          <span className="text-xs text-neutral-500">
            {scan.totalCount ?? scan.approvals.length} live
            {(scan.totalCount ?? 0) > scan.approvals.length
              ? ` · showing worst ${scan.approvals.length}`
              : ""}
            {" · "}worst score {worst}
          </span>
        </div>
        {scan.coverage && (
          <p className="mb-3 text-xs text-neutral-600">
            Coverage: {scan.coverage}. Every allowance shown was verified live
            on-chain — approval events alone are forgeable.
          </p>
        )}
        <div className="space-y-3">
          {scan.status === "loading" ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-8 text-center text-sm text-neutral-500">
              Scanning approval history and verifying live allowances on-chain…
            </div>
          ) : scan.approvals.length === 0 ? (
            <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-8 text-center text-sm text-neutral-400">
              No live token approvals found for {shortAddress(scan.address)}.
              This wallet is clean — nothing to revoke.
            </div>
          ) : (
            [...scan.approvals]
              .sort((a, b) => b.risk.score - a.risk.score)
              .map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  staged={staged.some((s) => s.approvalId === a.id)}
                  onStage={() => stageRevoke(a)}
                />
              ))
          )}
        </div>
      </section>

      {staged.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-neutral-300">
            Review queue — {staged.length} staged, awaiting your signature
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
        Steward never holds keys and never sends a transaction on its own. Token
        names are attacker-controlled and are quarantined before any agent sees
        them. The demo address is a deterministic fixture (including its planted
        hostile token); every other address is scanned live on-chain.
      </footer>
    </div>
  );
}
