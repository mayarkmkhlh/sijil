import { describe, expect, it } from "vitest";
import { clientIp, createExtractGuard, extractIsEnabled } from "./extract-guard.js";

describe("clientIp", () => {
  it("uses the last forwarded hop", () => {
    expect(clientIp(undefined)).toBe("unknown");
    expect(clientIp("  ")).toBe("unknown");
    expect(clientIp("203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("198.51.100.4, 203.0.113.9")).toBe("203.0.113.9");
  });
});

describe("extractIsEnabled", () => {
  it("treats false, 0, off, and no as the kill switch", () => {
    expect(extractIsEnabled("true")).toBe(true);
    expect(extractIsEnabled("")).toBe(true);
    expect(extractIsEnabled("false")).toBe(false);
    expect(extractIsEnabled("0")).toBe(false);
    expect(extractIsEnabled("off")).toBe(false);
    expect(extractIsEnabled("NO")).toBe(false);
  });
});

describe("createExtractGuard", () => {
  const hour = 60 * 60 * 1000;
  const evening = Date.parse("2026-11-03T20:00:00Z");
  const nextRiyadhDay = Date.parse("2026-11-03T22:00:00Z");

  it("resets the address bucket after an hour", () => {
    const guard = createExtractGuard({ enabled: true, ipLimit: 1, dailyLimit: 10 });
    expect(guard.allow("203.0.113.9", evening).ok).toBe(true);
    expect(guard.allow("203.0.113.9", evening + hour - 1).ok).toBe(false);
    expect(guard.allow("203.0.113.9", evening + hour).ok).toBe(true);
  });

  it("resets the daily count on the next Riyadh day", () => {
    const guard = createExtractGuard({ enabled: true, ipLimit: 10, dailyLimit: 1 });
    expect(guard.allow("203.0.113.9", evening).ok).toBe(true);
    const blocked = guard.allow("203.0.113.10", evening + 60_000);
    expect(blocked).toMatchObject({ ok: false, status: 503 });
    expect(guard.allow("203.0.113.9", nextRiyadhDay).ok).toBe(true);
  });
});
