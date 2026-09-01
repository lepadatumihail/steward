/**
 * The stage_swap risk gate, as a pure function so it is testable in isolation.
 *
 * This is page-enforced policy, not agent manners: an agent cannot stage the
 * purchase of a token Steward rates high-risk unless it passes
 * acknowledge_risk: true — which its instructions require it to do only after
 * telling the user the findings.
 */

export interface SwapGateInput {
  verdict: "high-risk" | "caution" | "no-major-flags" | "insufficient-data" | null;
  acknowledged: boolean;
  /** Shown to the agent so it can relay WHY. */
  signals: string[];
  tokenSymbolSafe: string;
}

export type SwapGateResult =
  | { allowed: true; warning: string | null }
  | { allowed: false; refusal: string };

export function swapGate(input: SwapGateInput): SwapGateResult {
  const { verdict, acknowledged, signals, tokenSymbolSafe } = input;

  if (verdict === "high-risk" && !acknowledged) {
    return {
      allowed: false,
      refusal:
        `REFUSED: ${tokenSymbolSafe} is rated HIGH-RISK by Steward's cross-source check` +
        `${signals.length ? ` (${signals.join("; ")})` : ""}. ` +
        `Tell the user these findings. If they still want it, call stage_swap again with acknowledge_risk: true.`,
    };
  }
  if (verdict === "high-risk") {
    return {
      allowed: true,
      warning: `HIGH-RISK acknowledged by the user: ${signals[0] ?? "see assess_token"}.`,
    };
  }
  if (verdict === "caution") {
    return {
      allowed: true,
      warning: `Caution: ${signals[0] ?? "this token has risk signals — see assess_token"}.`,
    };
  }
  if (verdict === "insufficient-data") {
    return {
      allowed: true,
      warning:
        "Fewer than two risk sources answered for this token — Steward could not verify it either way.",
    };
  }
  return { allowed: true, warning: null };
}
