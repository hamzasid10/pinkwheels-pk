export const SEARCHING_STATUSES = ["requested", "searching", "offered"];
export const ACTIVE_DRIVER_STATUSES = ["driver_assigned", "accepted", "driver_arriving", "arrived", "ride_started", "in_progress"];
export const TERMINAL_RIDE_STATUSES = ["completed", "cancelled", "expired"];
export function offerSeconds(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}
export function dispatchLog(event: string, detail?: unknown) {
  if (import.meta.env.DEV) console.debug(`[ride-dispatch] ${event}`, detail ?? "");
}