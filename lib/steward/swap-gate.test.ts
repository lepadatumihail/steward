import { describe, expect, test } from "bun:test";
import { swapGate } from "./swap-gate";

const base = { signals: ["sell tax 40%"], tokenSymbolSafe: "SCAM" };

describe("swapGate — the page-enforced purchase gate", () => {
  test("high-risk without acknowledgement is refused with instructions", () => {
    const r = swapGate({ ...base, verdict: "high-risk", acknowledged: false });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.refusal).toContain("REFUSED");
      expect(r.refusal).toContain("sell tax 40%");
      expect(r.refusal).toContain("acknowledge_risk: true");
    }
  });

  test("high-risk WITH acknowledgement passes, still warning", () => {
    const r = swapGate({ ...base, verdict: "high-risk", acknowledged: true });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.warning).toContain("HIGH-RISK acknowledged");
  });

  test("caution passes with a warning; acknowledgement not required", () => {
    const r = swapGate({ ...base, verdict: "caution", acknowledged: false });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.warning).toContain("Caution");
  });

  test("insufficient data is honest, not silent", () => {
    const r = swapGate({ ...base, verdict: "insufficient-data", acknowledged: false });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.warning).toContain("could not verify");
  });

  test("clean token: no warning", () => {
    const r = swapGate({ ...base, verdict: "no-major-flags", acknowledged: false });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.warning).toBeNull();
  });

  test("native ETH output (null verdict) passes clean", () => {
    const r = swapGate({ verdict: null, acknowledged: false, signals: [], tokenSymbolSafe: "ETH" });
    expect(r.allowed).toBe(true);
  });
});
