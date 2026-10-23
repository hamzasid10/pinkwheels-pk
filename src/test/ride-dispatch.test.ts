import { describe, expect, it } from "vitest";
import { ACTIVE_DRIVER_STATUSES, SEARCHING_STATUSES, TERMINAL_RIDE_STATUSES, offerSeconds } from "../lib/ride-dispatch";
import { hasActiveTrip } from "../lib/mode";
describe("ride dispatch", () => {
  it("expires a pending offer after 20 seconds", () => {
    const start = Date.parse("2026-10-23T21:00:00Z");
    const expiry = "2026-10-23T21:00:20Z";
    expect(offerSeconds(expiry, start)).toBe(20);
    expect(offerSeconds(expiry, start + 19000)).toBe(1);
    expect(offerSeconds(expiry, start + 20000)).toBe(0);
  });
  it("keeps offered rides searching until accepted", () => {
    expect(SEARCHING_STATUSES.includes("offered")).toBe(true);
    expect(SEARCHING_STATUSES.includes("accepted")).toBe(false);
  });
  it("prevents switching modes after acceptance and until completion", () => {
    for (const status of ACTIVE_DRIVER_STATUSES) expect(hasActiveTrip([status], [])).toBe(true);
    expect(hasActiveTrip(["completed"], [])).toBe(false);
  });
  it("expired rides are terminal, not upcoming", () => {
    expect(TERMINAL_RIDE_STATUSES.includes("expired")).toBe(true);
    expect(TERMINAL_RIDE_STATUSES.includes("accepted")).toBe(false);
  });
});