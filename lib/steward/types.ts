/** Steward's domain nouns. */

export type ChainId = "ethereum" | "base";

export interface TokenRef {
  address: string;
  /** ATTACKER-CONTROLLED. Never render or emit without quarantine. */
  name: string;
  /** ATTACKER-CONTROLLED. Never render or emit without quarantine. */
  symbol: string;
  decimals: number;
}

export interface Spender {
  address: string;
  /** ATTACKER-CONTROLLED when it comes from on-chain metadata. */
  label?: string;
  /** Verified source code on the chain's explorer. */
  verified: boolean;
  /** Present only for spenders on Steward's curated allowlist. */
  knownProtocol?: string;
}

export interface Approval {
  /** Stable key: chain:token:spender */
  id: string;
  chain: ChainId;
  token: TokenRef;
  spender: Spender;
  /** uint256 as a decimal string. */
  allowanceRaw: string;
  /** allowance === 2^256-1 (or close enough that it never depletes). */
  isUnlimited: boolean;
  /** ISO date of the approving transaction. */
  approvedAt: string;
  /** Balance at risk right now, as a decimal string in token units. */
  exposureRaw: string;
}

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface RiskAssessment {
  level: RiskLevel;
  /** 0-100. Higher is worse. */
  score: number;
  /** Human-readable, ordered by contribution. */
  reasons: string[];
  /** Quarantine flags raised by this approval's on-chain metadata. */
  metadataFlags: readonly string[];
}

export interface AssessedApproval extends Approval {
  risk: RiskAssessment;
}

/** A write the agent has prepared but cannot perform. */
export interface StagedAction {
  id: string;
  kind: "revoke";
  chain: ChainId;
  /** The contract the user's wallet will be asked to call. */
  to: string;
  /** ABI-encoded calldata for the wallet. */
  data: string;
  /** Plain-language description shown in Steward's own confirmation UI. */
  summary: string;
  approvalId: string;
  createdAt: string;
}
