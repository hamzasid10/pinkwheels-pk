export type AppMode = "passenger" | "driver";
export type DriverGate = "not_applied" | "pending" | "approved" | "rejected" | "suspended";

/** Maps the stored driver application status to the mode-switch gate. */
export function driverGate(status: string | null | undefined, suspendedAccount = false): DriverGate {
  if (suspendedAccount || status === "suspended") return "suspended";
  if (!status) return "not_applied";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending"; // pending, incomplete, info_requested
}

/** Only approved drivers may use Driver Mode; anything else falls back to Passenger Mode. */
export function effectiveMode(stored: AppMode | null, gate: DriverGate): AppMode {
  return stored === "driver" && gate === "approved" ? "driver" : "passenger";
}

/** A driver with an active ride or a started pool trip must finish it before leaving Driver Mode. */
export function hasActiveTrip(rideStatuses: string[], poolStatuses: string[]) {
  return rideStatuses.some((s) => s === "driver_arriving" || s === "ride_started") || poolStatuses.includes("started");
}

export const MODE_KEY = "pw-mode";
export const SESSION_KEY = "pw-mode-session";
