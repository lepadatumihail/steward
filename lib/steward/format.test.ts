/**
 * Regression tests for the boundary that matters most: nothing attacker-chosen
 * may reach an agent unfenced.
 *
 * A leak here was a real bug once — the staged-revoke summary embedded a raw
 * token symbol, zero-width space and all. These tests exist so it stays fixed.
 */
import { describe, expect, test } from "bun:test";
import { DEMO_APPROVALS } from "./fixtures";
import { formatApprovalDetail, formatApprovalsForAgent } from "./format";
import { assessApproval } from "./risk";
import type { AssessedApproval } from "./types";

const ZWSP = String.fromCharCode(0x200b);
const FENCE_OPEN = String.fromCharCode(0x27e6);
const FENCE_CLOSE = String.fromCharCode(0x27e7);

const assessed: AssessedApproval[] = DEMO_APPROVALS.map((a) => ({
  ...a,
  risk: assessApproval(a),
}));

const hostile = assessed.find((a) => a.risk.metadataFlags.length > 0)!;

/** Every fence must be opened and closed exactly in pairs. */
function fencesBalanced(text: string): boolean {
  const opens = (text.match(new RegExp(FENCE_OPEN, "g")) ?? []).length;
  const closes = (text.match(new RegExp(FENCE_CLOSE, "g")) ?? []).length;
  return opens === closes && opens % 2 === 0;
}

describe("the fixture actually contains an attack", () => {
  test("one approval carries hostile metadata", () => {
    expect(hostile).toBeDefined();
    expect(hostile.risk.metadataFlags).toContain("override-instruction");
    expect(hostile.risk.metadataFlags).toContain("hidden-characters");
    expect(hostile.risk.level).toBe("critical");
  });
});

describe("formatApprovalsForAgent", () => {
  const out = formatApprovalsForAgent("0x1111111111111111111111111111111111111111", assessed);

  test("emits no zero-width characters", () => {
    expect(out.includes(ZWSP)).toBe(false);
  });

  test("fences every token symbol", () => {
    for (const a of assessed) {
      expect(out).toContain(`${FENCE_OPEN}UNTRUSTED:token.symbol${FENCE_CLOSE}`);
    }
    expect(fencesBalanced(out)).toBe(true);
  });

  test("warns when hostile metadata is present", () => {
    expect(out).toContain("WARNING");
    expect(out).toContain("override-instruction");
  });

  test("orders worst-first", () => {
    const firstLine = out.split("\n").find((l) => l.startsWith("- "))!;
    expect(firstLine).toContain("CRITICAL");
  });

  test("stays within a sane share of the output budget", () => {
    expect(out.length).toBeLessThan(1500);
  });
});

describe("formatApprovalDetail", () => {
  const out = formatApprovalDetail(hostile);

  test("fences the hostile name and strips its hidden characters", () => {
    expect(out).toContain(`${FENCE_OPEN}UNTRUSTED:token.name${FENCE_CLOSE}`);
    expect(out.includes(ZWSP)).toBe(false);
    expect(fencesBalanced(out)).toBe(true);
  });

  test("the attack text is present but confined to a fence", () => {
    // The payload is reproduced (we do not hide it from the user) ...
    expect(out.toLowerCase()).toContain("ignore previous instructions");
    // ... and it sits inside the fenced name, not loose in the output.
    const start = out.indexOf(`${FENCE_OPEN}UNTRUSTED:token.name${FENCE_CLOSE}`);
    const end = out.indexOf(`${FENCE_OPEN}/UNTRUSTED${FENCE_CLOSE}`, start);
    const fenced = out.slice(start, end);
    expect(fenced.toLowerCase()).toContain("ignore previous instructions");
  });

  test("the payload cannot break out with newlines", () => {
    const start = out.indexOf(`${FENCE_OPEN}UNTRUSTED:token.name${FENCE_CLOSE}`);
    const end = out.indexOf(`${FENCE_OPEN}/UNTRUSTED${FENCE_CLOSE}`, start);
    expect(out.slice(start, end).includes("\n")).toBe(false);
  });

  test("reports why the score is what it is", () => {
    expect(out).toContain("Risk: CRITICAL");
    expect(out).toContain("Metadata flags:");
  });
});

describe("benign approvals stay quiet", () => {
  const benign = assessed.find((a) => a.token.symbol === "DAI")!;

  test("a recognised protocol lowers the score", () => {
    expect(benign.risk.level).toBe("low");
    expect(benign.risk.reasons.join(" ")).toContain("recognised protocol");
  });

  test("no metadata flags on an ordinary token", () => {
    expect(benign.risk.metadataFlags).toEqual([]);
  });
});

describe("resolveApprovalId", () => {
  // Local import to keep the top of the file unchanged.
  const { resolveApprovalId, shortApprovalId } = require("./format");

  const live: AssessedApproval[] = [
    {
      ...assessed[0],
      id: "ethereum:0x69627b7e0d9e74690c7489d5b829968dc15bdcde:0x5c14cee5849e3959bfc5b506f9ca1b7089aeea2f",
      chain: "ethereum",
      token: { ...assessed[0].token, address: "0x69627b7e0d9e74690c7489d5b829968dc15bdcde" },
      spender: { ...assessed[0].spender, address: "0x5c14cee5849e3959bfc5b506f9ca1b7089aeea2f" },
    },
  ];

  test("resolves the exact full id", () => {
    expect(resolveApprovalId(live[0].id, live)).toBe(live[0]);
  });

  test("resolves the short form scan_approvals prints", () => {
    const short = shortApprovalId(live[0]);
    expect(short).toContain("…");
    expect(resolveApprovalId(short, live)).toBe(live[0]);
  });

  test("resolves an ASCII-ellipsis variant an agent might retype", () => {
    expect(
      resolveApprovalId("ethereum:0x6962...dcde:0x5c14...ea2f", live),
    ).toBe(live[0]);
  });

  test("returns undefined for junk and for the wrong chain", () => {
    expect(resolveApprovalId("nonsense", live)).toBeUndefined();
    expect(resolveApprovalId("base:0x6962…dcde:0x5c14…ea2f", live)).toBeUndefined();
  });
});
