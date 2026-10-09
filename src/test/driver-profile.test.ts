import { describe, expect, it } from "vitest";
import { driverTotals } from "@/lib/driver-profile";

describe("Real driver statistics", () => {
  it("does not invent statistics for an empty account", () => {
    expect(driverTotals([], [], [])).toEqual({ completedRides: 0, rideEarnings: 0, poolEarnings: 0, totalEarnings: 0 });
  });
  it("counts completed journeys once and sums only completed owned fares", () => {
    expect(driverTotals([{ status: "completed", fare: 700 }, { status: "cancelled", fare: 900 }],
      [{ id: "own", status: "completed" }],
      [{ pool_route_id: "own", request_status: "completed", fare: 300 }, { pool_route_id: "own", request_status: "completed", fare: 200 }, { pool_route_id: "own", request_status: "pending", fare: 100 }, { pool_route_id: "other", request_status: "completed", fare: 1000 }])).toEqual({ completedRides: 2, rideEarnings: 700, poolEarnings: 500, totalEarnings: 1200 });
  });
});