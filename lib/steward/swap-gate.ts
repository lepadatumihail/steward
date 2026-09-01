/**
 * The stage_swap risk gate, as a pure function so it is testable in isolation.
 *
 * This is page-enforced policy, not agent manners: an agent cannot stage the
 * purchase of a token Steward rates high-risk unless it passes
 * acknowledge_risk: true — which its instructions require it to do only after
 * telling the user the findings.
 *
 * It FAILS CLOSED: a missing or unrecognised verdict is a refusal, because an
 * infrastructure failure must never read as a clean bill of health.
 */

import type { TokenIntel } from "./types";

export interface SwapGateInput {
  /**
   * The server's verdict, or null. null means two DIFFERENT things and the
   * caller must say which: native ETH needs no token check (`nativeOutput`),
   * while a failed check is a refusal, not a pass.
   */
  verdict: TokenIntel["verdict"] | null;
  /** True when tokenOut is native ETH — there is no token to vet. */
  nativeOutput?: boolean;
  acknowledged: boolean;
  /** Shown to the agent so it can relay WHY. */
  signals: string[];
  tokenSymbolSafe: string;
}

export type SwapGateResult =
  | { allowed: true; warning: string | null }
  | { allowed: false; refusal: string };

export function swapGate(input: SwapGateInput): SwapGateResult {
  const { verdict, acknowledged, signals, tokenSymbolSafe, nativeOutput } = input;

  // Native ETH: nothing to vet, nothing to warn about.
  if (nativeOutput) return { allowed: true, warning: null };

  // FAIL CLOSED. A missing verdict means the risk check did not run — an
  // infrastructure failure must never read as a clean bill of health, which
  // is exactly what the old fallthrough did.
  if (verdict == null) {
    return {
      allowed: false,
      refusal:
        `REFUSED: Steward could not run its risk check on ${tokenSymbolSafe} ` +
        `(the token-intel sources are unreachable). Staging a buy without a ` +
        `completed check is not something this page will do. Tell the user the ` +
        `check failed and try again shortly.`,
    };
  }

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
  if (verdict === "no-major-flags") return { allowed: true, warning: null };

  // Any verdict this function does not recognise (a future server-side value)
  // fails closed rather than silently passing.
  return {
    allowed: false,
    refusal:
      `REFUSED: unrecognised risk verdict "${String(verdict)}" for ${tokenSymbolSafe}. ` +
      `Steward will not stage a buy it cannot interpret.`,
  };
}
