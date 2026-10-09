export type CompletedRide = { status: string; fare: number };
export type PoolTrip = { id: string; status: string };
export type PoolSeat = { pool_route_id: string; request_status: string; fare: number };

/** Gross fares from completed bookings only; no estimated income or assumed fees. */
export function driverTotals(rides: CompletedRide[], routes: PoolTrip[], seats: PoolSeat[]) {
  const completed = rides.filter((r) => r.status === "completed");
  const completedRoutes = routes.filter((r) => r.status === "completed");
  const owned = new Set(routes.map((r) => r.id));
  const poolEarnings = seats.filter((s) => owned.has(s.pool_route_id) && s.request_status === "completed").reduce((sum, s) => sum + s.fare, 0);
  const rideEarnings = completed.reduce((sum, r) => sum + r.fare, 0);
  return { completedRides: completed.length + completedRoutes.length, rideEarnings, poolEarnings, totalEarnings: rideEarnings + poolEarnings };
}

export const DRIVER_STATUS: Record<string, string> = {
  incomplete: "Application incomplete", pending: "Verification pending", info_requested: "More information needed",
  approved: "Verified driver", rejected: "Application not approved", suspended: "Account suspended",
};