"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  encodeFunctionData,
  isAddress,
  parseEther,
  parseUnits,
} from "viem";
import { normalize } from "viem/ens";
import { getEnsAddress, readContract } from "wagmi/actions";
import { erc20Abi } from "viem";
import { wagmiConfig } from "./Providers";
import { ProviderNotFoundError,
  useConnect, useConnection, useDisconnect } from "wagmi";
import { useStewardTool } from "@/lib/webmcp/useStewardTool";
import {
  getModelContextMode,
  installShim,
  type ModelContextMode,
} from "@/lib/webmcp/shim";
import { quarantine, sanitizeUntrusted } from "@/lib/webmcp/quarantine";
import { swapGate } from "@/lib/steward/swap-gate";
import { DEMO_ADDRESS, DEMO_APPROVALS } from "@/lib/steward/fixtures";
import { assessApproval } from "@/lib/steward/risk";
import {
  formatApprovalDetail,
  formatApprovalsForAgent,
  formatTokenIntel,
  resolveApprovalId,
  shortAddress,
} from "@/lib/steward/format";
import type {
  AssessedApproval,
  ChainId,
  StagedAction,
  TokenIntel,
} from "@/lib/steward/types";
import { ApprovalCard } from "./ApprovalCard";
import { StagedActionCard } from "./StagedActionCard";
import { TokenIntelCard } from "./TokenIntelCard";
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
  const [intel, setIntel] = useState<TokenIntel | null>(null);
  // Read after mount: the server has no model context, so reading during render
  // would produce a hydration mismatch.
  const [contextMode, setContextMode] = useState<ModelContextMode>("none");
  useEffect(() => setContextMode(getModelContextMode()), []);

  const connection = useConnection();
  // Tools close over the connected address through a ref, same reason as scanRef.
  const addressRef = useRef<string | undefined>(undefined);
  addressRef.current = connection.address;
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

  const assessTool = useStewardTool<{ token: string; chain?: string }>({
    name: "assess_token",
    description:
      "Assess whether an ERC-20 token is safe to hold or exit: honeypot simulation, sell taxes, owner powers, contract verification, and real market liquidity, cross-checked across three independent sources. Pass the token CONTRACT address (scan_approvals ids embed it). Security signals, not financial advice.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The token's contract address (0x…).",
        },
        chain: {
          type: "string",
          description: '"Ethereum" (default) or "Base".',
        },
      },
      required: ["token"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ token, chain: chainArg }) => {
      const targetChain: ChainId =
        chainArg?.toLowerCase() === "base" ? "base" : "ethereum";
      const addr = token?.trim();
      if (!isAddress(addr)) {
        throw new Error(
          `"${token}" is not a token contract address. Pass the 0x… address — scan_approvals ids contain it as the middle segment.`,
        );
      }
      const res = await fetch(
        `/api/token?address=${addr}&chain=${targetChain}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error ??
            `assessment failed (${res.status})`,
        );
      }
      const result = (await res.json()) as TokenIntel;
      setIntel(result); // the dashboard shows what the agent just learned
      return formatTokenIntel(result);
    },
  });

  const transferTool = useStewardTool<{
    token: string;
    amount: string;
    to: string;
    chain?: string;
  }>({
    name: "stage_transfer",
    description:
      'Prepare a token or ETH transfer and place it in Steward\'s review queue. This does NOT send anything: the user must review and sign it in their own wallet. token is a contract address or "ETH"; amount is a decimal string; to is a 0x address or ENS name.',
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: 'Token contract address (0x…) or "ETH" for native ether.',
        },
        amount: {
          type: "string",
          description: 'Human units, e.g. "0.05" or "125.5".',
        },
        to: {
          type: "string",
          description: "Recipient: 0x address or ENS name.",
        },
        chain: {
          type: "string",
          description: '"Ethereum" (default) or "Base".',
        },
      },
      required: ["token", "amount", "to"],
    },
    // Stages state the user must act on, and echoes a token symbol.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async ({ token, amount, to, chain: chainArg }) => {
      const targetChain: ChainId =
        chainArg?.toLowerCase() === "base" ? "base" : "ethereum";
      const chainId = targetChain === "ethereum" ? 1 : 8453;

      if (!/^\d+(\.\d+)?$/.test(amount.trim()) || Number(amount) <= 0) {
        throw new Error(
          `"${amount}" is not a positive decimal amount, e.g. "0.05".`,
        );
      }

      // Resolve the recipient. ENS lives on mainnet regardless of the chain.
      let recipient = to.trim();
      if (!isAddress(recipient)) {
        if (!/\.eth$/i.test(recipient)) {
          throw new Error(
            `"${to}" is neither a 0x address nor an ENS name.`,
          );
        }
        const resolved = await getEnsAddress(wagmiConfig, {
          name: normalize(recipient),
          chainId: 1,
        });
        if (!resolved) throw new Error(`ENS name "${to}" does not resolve.`);
        recipient = resolved;
      }

      const isNative = /^(eth|native)$/i.test(token.trim());
      let action: StagedAction;
      if (isNative) {
        action = {
          id: `transfer-eth-${recipient}-${Date.now()}`,
          kind: "transfer",
          chain: targetChain,
          to: recipient,
          valueWei: parseEther(amount as `${number}`).toString(),
          summary: `Send ${amount} ETH to ${shortAddress(recipient)} on ${targetChain}`,
          createdAt: new Date().toISOString(),
        };
      } else {
        if (!isAddress(token.trim())) {
          throw new Error(
            `"${token}" is not a token contract address. Use the 0x… address or "ETH".`,
          );
        }
        const tokenAddr = token.trim() as `0x${string}`;
        const [decimals, symbol] = await Promise.all([
          readContract(wagmiConfig, {
            address: tokenAddr,
            abi: erc20Abi,
            functionName: "decimals",
            chainId,
          }),
          readContract(wagmiConfig, {
            address: tokenAddr,
            abi: erc20Abi,
            functionName: "symbol",
            chainId,
          }).catch(() => "tokens"),
        ]);
        const units = parseUnits(amount as `${number}`, Number(decimals));
        action = {
          id: `transfer-${tokenAddr}-${recipient}-${Date.now()}`,
          kind: "transfer",
          chain: targetChain,
          to: tokenAddr,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient as `0x${string}`, units],
          }),
          summary: `Send ${amount} ${sanitizeUntrusted(String(symbol), 16).safe} to ${shortAddress(recipient)} on ${targetChain}`,
          createdAt: new Date().toISOString(),
        };
      }

      setStaged((prev) => [...prev, action]);
      return (
        `awaiting_user_confirmation\n` +
        `${action.summary}.\n` +
        `It is now in Steward's review queue. The user must confirm and sign it in their wallet. ` +
        `You cannot complete this action, and neither can this page.`
      );
    },
  });

  const swapTool = useStewardTool<{
    token_in: string;
    token_out: string;
    amount: string;
    chain?: string;
    acknowledge_risk?: boolean;
  }>({
    name: "stage_swap",
    description:
      'Quote a token swap via the KyberSwap aggregator and stage it for the user to sign. Does NOT trade: the user must sign in their own wallet. The output token is risk-checked automatically; a high-risk token is refused unless the user has been told and acknowledge_risk is true. token_in/token_out are contract addresses or "ETH".',
    inputSchema: {
      type: "object",
      properties: {
        token_in: { type: "string", description: '"ETH" or the 0x… token to sell.' },
        token_out: { type: "string", description: '"ETH" or the 0x… token to buy.' },
        amount: { type: "string", description: 'Amount of token_in in human units, e.g. "0.001".' },
        chain: { type: "string", description: '"Base" (default) or "Ethereum".' },
        acknowledge_risk: {
          type: "boolean",
          description: "Set true ONLY after telling the user the token was rated high-risk and they still want it staged.",
        },
      },
      required: ["token_in", "token_out", "amount"],
    },
    // Stages state; echoes token symbols; both write-path and untrusted.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async ({ token_in, token_out, amount, chain: chainArg, acknowledge_risk }) => {
      const targetChain: ChainId =
        chainArg?.toLowerCase() === "ethereum" ? "ethereum" : "base";
      const sender = addressRef.current;

      const params = new URLSearchParams({
        chain: targetChain,
        tokenIn: token_in.trim(),
        tokenOut: token_out.trim(),
        amount: amount.trim(),
      });
      if (sender) params.set("sender", sender);
      const res = await fetch(`/api/swap-quote?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error ?? `quote failed (${res.status})`,
        );
      }
      const quote = (await res.json()) as {
        tokenIn: { address: string; symbol: string; decimals: number };
        tokenOut: { address: string; symbol: string; decimals: number };
        amountIn: string;
        amountOut: string;
        minReceived: string;
        amountOutUsd: number | null;
        gasUsd: number | null;
        intel: { verdict: string; signals: string[] } | null;
        tx: {
          needsApproval: boolean;
          approve?: { to: string; data: string };
          swap: { to: string; data: string; valueWei: string };
        } | null;
      };

      const inSym = sanitizeUntrusted(quote.tokenIn.symbol, 12).safe;
      const outSym = sanitizeUntrusted(quote.tokenOut.symbol, 12).safe;
      const fmt = (raw: string, d: number) => {
        try {
          const n = Number(raw) / 10 ** d;
          return n < 0.0001 ? "<0.0001" : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
        } catch {
          return "?";
        }
      };
      const gasText =
        quote.gasUsd == null
          ? ""
          : quote.gasUsd < 0.01
            ? ", <$0.01 gas"
            : `, ~$${quote.gasUsd.toFixed(2)} gas`;
      const quoteLine =
        `${fmt(quote.amountIn, quote.tokenIn.decimals)} ${inSym} -> ` +
        `${fmt(quote.amountOut, quote.tokenOut.decimals)} ${outSym}` +
        ` (min ${fmt(quote.minReceived, quote.tokenOut.decimals)} after 0.5% slippage${gasText})`;

      // The page's gate, not the agent's manners: high-risk needs an explicit,
      // user-informed acknowledgement before anything is staged. Pure function,
      // unit-tested in lib/steward/swap-gate.test.ts.
      const gate = swapGate({
        verdict: quote.intel?.verdict as never ?? null,
        acknowledged: acknowledge_risk === true,
        signals: quote.intel?.signals ?? [],
        tokenSymbolSafe: outSym,
      });
      if (!gate.allowed) throw new Error(gate.refusal);

      if (!sender || !quote.tx) {
        return (
          `Quote only — no wallet connected, nothing staged.\n${quoteLine}\n` +
          (gate.warning ? `${gate.warning}\n` : "") +
          (quote.intel ? `Token check: ${quote.intel.verdict}.\n` : "") +
          `Connect a wallet in Steward (top right) and call stage_swap again to stage it for signing.`
        );
      }

      const stamp = Date.now();
      const actions: StagedAction[] = [];
      if (quote.tx.needsApproval && quote.tx.approve) {
        actions.push({
          id: `approve-${quote.tokenIn.address}-${stamp}`,
          kind: "approve",
          chain: targetChain,
          to: quote.tx.approve.to,
          data: quote.tx.approve.data,
          summary: `Step 1 of 2: allow KyberSwap router to spend EXACTLY ${fmt(quote.amountIn, quote.tokenIn.decimals)} ${inSym} (not unlimited)`,
          meta: ["Sign this before the swap. Exact-amount allowance only."],
          createdAt: new Date().toISOString(),
        });
      }
      actions.push({
        id: `swap-${quote.tokenIn.address}-${quote.tokenOut.address}-${stamp}`,
        kind: "swap",
        chain: targetChain,
        to: quote.tx.swap.to,
        data: quote.tx.swap.data,
        ...(quote.tx.swap.valueWei !== "0" ? { valueWei: quote.tx.swap.valueWei } : {}),
        summary: `${quote.tx.needsApproval ? "Step 2 of 2: swap" : "Swap"} ${fmt(quote.amountIn, quote.tokenIn.decimals)} ${inSym} -> ${outSym} via KyberSwap`,
        meta: [
          `Minimum received: ${fmt(quote.minReceived, quote.tokenOut.decimals)} ${outSym} (0.5% slippage cap)`,
          ...(quote.intel ? [`Token check: ${quote.intel.verdict}`] : []),
          "Router pinned to KyberSwap MetaAggregationRouterV2",
        ],
        createdAt: new Date().toISOString(),
      });
      setStaged((prev) => [...prev, ...actions]);

      return (
        `awaiting_user_confirmation\n${quoteLine}\n` +
        (gate.warning ? `${gate.warning}\n` : "") +
        (quote.intel ? `Token check: ${quote.intel.verdict}.\n` : "") +
        `Staged ${actions.length === 2 ? "an exact-amount approval plus the swap" : "the swap"} in Steward's review queue. ` +
        `The user must sign in their wallet${actions.length === 2 ? ", approval first" : ""}. ` +
        `You cannot execute this, and neither can this page.`
      );
    },
  });

  const gasTool = useStewardTool<{ chain?: string }>({
    name: "check_gas",
    description:
      "Read current network fees and report whether this is a cheap, typical, or elevated moment relative to the last few minutes, with the estimated cost of one revoke transaction.",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          description: '"Ethereum" (default) or "Base".',
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async ({ chain: chainArg }) => {
      const targetChain: ChainId =
        chainArg?.toLowerCase() === "base" ? "base" : "ethereum";
      const res = await fetch(`/api/gas?chain=${targetChain}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { error?: string } | null)?.error ??
            `gas read failed (${res.status})`,
        );
      }
      const g = await res.json();
      return (
        `Gas on ${g.chain} is ${g.verdict.toUpperCase()} right now.\n` +
        `Base fee ${g.baseFeeGwei} gwei (window ${g.windowMinGwei}-${g.windowMaxGwei}, median ${g.windowMedianGwei}) over the ${g.windowDescription}; median priority tip ${g.priorityP50Gwei} gwei.\n` +
        `One revoke costs about ${g.revokeCostEth} ETH at these fees.\n` +
        `"Cheap" and "elevated" are relative to that window, not to history.`
      );
    },
  });

  const tools = [
    { label: "scan_approvals", state: scanTool },
    { label: "explain_approval", state: explainTool },
    { label: "assess_token", state: assessTool },
    { label: "check_gas", state: gasTool },
    { label: "stage_revoke", state: revokeTool },
    { label: "stage_transfer", state: transferTool },
    { label: "stage_swap", state: swapTool },
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
            <span className="ml-3 text-sm font-normal text-neutral-700">
              wallet safety, agent-readable
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/lepadatumihail/steward"
              className="text-xs text-neutral-600 underline-offset-4 hover:underline"
            >
              open source
            </a>
            {connection.isConnected ? (
              <button
                onClick={() => disconnect()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
                title="Disconnect wallet"
              >
                {shortAddress(connection.address ?? "")} ·{" "}
                <span className="text-neutral-600">disconnect</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const injectedConnector = connectors[0];
                  if (injectedConnector) connect({ connector: injectedConnector });
                }}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
              >
                Connect wallet
              </button>
            )}
          </div>
        </div>
        {!connection.isConnected && connectError && (
          <p className="mt-2 text-xs text-amber-700">
            {connectError instanceof ProviderNotFoundError
              ? "No browser wallet found — Steward still works watch-only; a wallet is only needed to sign revokes."
              : connectError.message.split("\n")[0]}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">
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
          className="min-w-0 flex-1 basis-56 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-neutral-400"
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as ChainId)}
          className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-900"
          aria-label="Chain"
        >
          <option value="ethereum">Ethereum</option>
          <option value="base">Base</option>
        </select>
        <button
          type="submit"
          disabled={scan.status === "loading"}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          {scan.status === "loading" ? "Scanning…" : "Audit"}
        </button>
      </form>

      <ToolStatusPanel tools={tools} mode={contextMode} />

      {intel && <TokenIntelCard intel={intel} onDismiss={() => setIntel(null)} />}

      {scan.status === "error" && (
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Live scan unavailable: {scan.error}
          <span className="block pt-1 text-xs text-red-700/90">
            The demo address still works offline — every data source Steward uses
            is keyless public infrastructure, and sometimes it has a bad minute.
          </span>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-neutral-900">
            Approvals for {shortAddress(scan.address)}
            {scan.status === "demo" && (
              <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-700">
                demo data
              </span>
            )}
            {scan.status === "live" && (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                live · {scan.chain}
              </span>
            )}
          </h2>
          <span className="text-xs text-neutral-600">
            {scan.totalCount ?? scan.approvals.length} live
            {(scan.totalCount ?? 0) > scan.approvals.length
              ? ` · showing worst ${scan.approvals.length}`
              : ""}
            {" · "}worst score {worst}
          </span>
        </div>
        {scan.coverage && (
          <p className="mb-3 text-xs text-neutral-500">
            Coverage: {scan.coverage}. Every allowance shown was verified live
            on-chain — approval events alone are forgeable.
          </p>
        )}
        <div className="space-y-3">
          {scan.status === "loading" ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-600">
              Scanning approval history and verifying live allowances on-chain…
            </div>
          ) : scan.approvals.length === 0 ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-8 text-center text-sm text-neutral-700">
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
          <h2 className="mb-3 text-sm font-medium text-neutral-900">
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

      <footer className="mt-16 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-500">
        Steward never holds keys and never sends a transaction on its own. Token
        names are attacker-controlled and are quarantined before any agent sees
        them. The demo address is a deterministic fixture (including its planted
        hostile token); every other address is scanned live on-chain.
      </footer>
    </div>
  );
}
