/**
 * Approval-event harvesting.
 *
 * Two sources, chosen per chain from live probes (2026-09-01):
 *
 *  - Ethereum mainnet: Blockscout's Etherscan-compatible getLogs. Keyless,
 *    full history in ~5 pages for even a very busy wallet, and every row
 *    carries a hex `timeStamp` so approval age costs zero extra calls.
 *
 *  - Base: a bounded walk of 10,000-block windows over public RPC
 *    (mainnet.base.org). Blockscout Base is dead (10-req budget, ~42min
 *    lockout) and full history would be ~5,000 windows, so we deliberately
 *    scan only a recent window — enough for the demo burner, honest about
 *    truncation for everything else.
 *
 * IMPORTANT: a logged Approval event proves nothing about the present.
 * Approvals get overwritten, revoked, and spoofed (anyone can emit an
 * Approval-shaped event from a contract they control). Every candidate pair
 * that leaves this module MUST be ground-truthed with a live allowance()
 * read before it is shown to anyone. That happens in scan.ts.
 */

import { parseAbiItem, type PublicClient } from "viem";
import { baseClient } from "./chains";

/** keccak256("Approval(address,address,uint256)") */
export const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

export interface RawApproval {
  token: string;
  spender: string;
  /** uint256 hex from log data. */
  valueHex: string;
  blockNumber: number;
  logIndex: number;
  /** Unix seconds; 0 when the source cannot provide it cheaply. */
  timestamp: number;
}

export interface HarvestResult {
  /** Latest approval event per (token, spender), ERC-721 rows dropped. */
  pairs: RawApproval[];
  truncated: boolean;
  /** Human-readable description of what was actually scanned. */
  coverage: string;
}

const BLOCKSCOUT = "https://eth.blockscout.com/api";
const PAGE_CAP = 8; // 8 × 1000 rows; beyond this we truncate and say so
const BASE_WINDOW = 10_000n; // probe-verified max range on mainnet.base.org
const BASE_WINDOWS = 30; // 300k blocks ≈ 7 days at Base's 2s cadence

function pad32(address: string): string {
  return "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Blockscout fetch with backoff. Treats HTTP 500 as a throttle signal, not
 * just 429 — probed Blockscout instances emit 500s *before* escalating to
 * 429, and `result` can be null on a 200, which must not crash the caller.
 */
async function blockscoutGet(params: URLSearchParams): Promise<unknown[]> {
  let delay = 800;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BLOCKSCOUT}?${params}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
      const body = (await res.json()) as { result?: unknown };
      if (Array.isArray(body.result)) return body.result;
      // "No records found" comes back as status 0 with a string result.
      if (typeof body.result === "string" || body.result == null) return [];
      return [];
    } catch {
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error("Blockscout unavailable after retries");
}

/** Reduce raw rows to the LATEST event per (token, spender). */
function latestPerPair(rows: RawApproval[]): RawApproval[] {
  const best = new Map<string, RawApproval>();
  for (const row of rows) {
    const key = `${row.token}:${row.spender}`;
    const prev = best.get(key);
    if (
      !prev ||
      row.blockNumber > prev.blockNumber ||
      (row.blockNumber === prev.blockNumber && row.logIndex > prev.logIndex)
    ) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

export async function harvestMainnet(owner: string): Promise<HarvestResult> {
  const seen = new Set<string>();
  const rows: RawApproval[] = [];
  let fromBlock = 0;
  let truncated = false;

  for (let page = 0; page < PAGE_CAP; page++) {
    const params = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      fromBlock: String(fromBlock),
      toBlock: "latest",
      topic0: APPROVAL_TOPIC,
      topic1: pad32(owner),
      topic0_1_opr: "and",
    });
    const batch = (await blockscoutGet(params)) as Array<{
      address: string;
      topics: (string | null)[];
      data: string;
      blockNumber: string;
      logIndex: string;
      transactionHash: string;
      timeStamp: string;
    }>;

    for (const log of batch) {
      const dedupeKey = `${log.transactionHash}:${log.logIndex}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // ERC-721 Approval has an indexed tokenId => 4 topics. Skip those.
      const topics = (log.topics ?? []).filter((t) => t != null);
      if (topics.length !== 3) continue;

      rows.push({
        token: log.address.toLowerCase(),
        spender: "0x" + topics[2]!.slice(-40).toLowerCase(),
        valueHex: log.data === "0x" ? "0x0" : log.data,
        blockNumber: parseInt(log.blockNumber, 16),
        logIndex: parseInt(log.logIndex, 16) || 0,
        timestamp: parseInt(log.timeStamp, 16) || 0,
      });
    }

    if (batch.length < 1000) break; // last page
    if (page === PAGE_CAP - 1) {
      truncated = true;
      break;
    }
    // Advance with a 1-block overlap; the (txHash, logIndex) set dedupes it.
    fromBlock = Math.max(...batch.map((l) => parseInt(l.blockNumber, 16)));
  }

  return {
    pairs: latestPerPair(rows),
    truncated,
    coverage: truncated
      ? `first ${PAGE_CAP}k approval events (history truncated for this unusually busy wallet)`
      : "full approval history",
  };
}

export async function harvestBaseRecent(owner: string): Promise<HarvestResult> {
  const client = baseClient as PublicClient;
  const head = await client.getBlockNumber();
  const floor = head - BASE_WINDOW * BigInt(BASE_WINDOWS);
  const event = parseAbiItem(
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  );

  const rows: RawApproval[] = [];
  // Newest-first so a fresh burner's approvals land in the first windows.
  const windows: Array<{ from: bigint; to: bigint }> = [];
  for (let to = head; to > floor; to -= BASE_WINDOW) {
    const from = to - BASE_WINDOW + 1n > floor ? to - BASE_WINDOW + 1n : floor;
    windows.push({ from, to });
  }

  // Modest parallelism: base.org showed no throttle in a 30-call burst, but
  // it is now the single keyless Base lane and deserves gentle treatment.
  const CONCURRENCY = 5;
  for (let i = 0; i < windows.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      windows.slice(i, i + CONCURRENCY).map((w) =>
        client.getLogs({
          event,
          args: { owner: owner as `0x${string}` },
          fromBlock: w.from,
          toBlock: w.to,
        }),
      ),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const log of r.value) {
        rows.push({
          token: log.address.toLowerCase(),
          spender: (log.args.spender ?? "0x").toLowerCase(),
          valueHex: "0x" + (log.args.value ?? 0n).toString(16),
          blockNumber: Number(log.blockNumber ?? 0n),
          logIndex: log.logIndex ?? 0,
          timestamp: 0, // filled below for the few blocks that matter
        });
      }
    }
  }

  const pairs = latestPerPair(rows);

  // Timestamps: only the surviving pairs' blocks, capped, so a burner costs
  // a handful of getBlock calls and a spammed wallet cannot amplify them.
  const uniqueBlocks = [...new Set(pairs.map((p) => p.blockNumber))].slice(0, 25);
  const stamps = new Map<number, number>();
  await Promise.allSettled(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: BigInt(bn) });
      stamps.set(bn, Number(block.timestamp));
    }),
  );
  for (const p of pairs) p.timestamp = stamps.get(p.blockNumber) ?? 0;

  return {
    pairs,
    truncated: true, // by design: a recent window, never full history
    coverage: `most recent ~${(BASE_WINDOW * BigInt(BASE_WINDOWS)).toLocaleString()} Base blocks (~7 days)`,
  };
}
