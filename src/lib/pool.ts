import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { estimateKm } from "@/lib/pink";
import type { Database } from "@/integrations/supabase/types";

export type PoolRoute = Database["public"]["Tables"]["pool_routes"]["Row"];
export type PoolSeat = Database["public"]["Tables"]["pool_seat_requests"]["Row"];
export type PoolRouteStatus = Database["public"]["Enums"]["pool_route_status"];
export type PoolSeatStatus = Database["public"]["Enums"]["pool_request_status"];

export const ROUTE_STATUS_LABEL: Record<PoolRouteStatus, string> = {
  open: "Open",
  almost_full: "Almost Full",
  full: "Full",
  started: "Started",
  completed: "Completed",
  cancelled: "Cancelled",
  suspended: "Suspended",
};

export const SEAT_STATUS_LABEL: Record<PoolSeatStatus, string> = {
  pending: "Waiting for Driver Approval",
  accepted: "Seat Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const FLEX_OPTIONS = [
  { v: 0, l: "On time" },
  { v: 10, l: "±10 minutes" },
  { v: 15, l: "±15 minutes" },
  { v: 30, l: "±30 minutes" },
];

/** MVP: pseudo pickup/drop-off deviation from the driver's route (0–2.9 km). Replace with a maps API later. */
export function deviationKm(start: string, dest: string, pickup: string, drop: string) {
  if (!pickup.trim() || !drop.trim()) return 0;
  const n = (estimateKm(pickup, start) * 7 + estimateKm(drop, dest) * 3) % 30;
  return Math.round(n) / 10;
}

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
}

export function platformFee(fare: number, seats: number, s?: { pool_fee_type: string; pool_fee_value: number } | null) {
  if (!s) return 0;
  return s.pool_fee_type === "fixed" ? Math.round(Number(s.pool_fee_value) * seats) : Math.round((fare * Number(s.pool_fee_value)) / 100);
}

export function fmtDate(d: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (d === today) return "Today";
  return new Date(d + "T00:00").toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function minutesBetween(a: string, b: string) {
  const f = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return Math.abs(f(a) - f(b));
}
