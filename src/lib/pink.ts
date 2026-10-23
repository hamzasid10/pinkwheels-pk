import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Vehicle = "car" | "scooty" | "bike";
export type RideStatus =
  | "searching" | "offered" | "accepted" | "arrived" | "in_progress" | "expired"
  | "requested"
  | "driver_assigned"
  | "driver_arriving"
  | "ride_started"
  | "completed"
  | "cancelled";

export const VEHICLES: { id: Vehicle; label: string; desc: string; base: number; perKm: number }[] = [
  { id: "car", label: "Car", desc: "Up to 4 riders, AC comfort", base: 250, perKm: 45 },
  { id: "scooty", label: "Scooty", desc: "Quick city trips, solo", base: 120, perKm: 22 },
  { id: "bike", label: "Bike", desc: "Fastest & most affordable", base: 100, perKm: 20 },
];

export const STATUS_LABEL: Record<RideStatus, string> = {
  searching: "Finding your driver", offered: "Finding your driver", accepted: "Driver accepted", arrived: "Driver arrived", in_progress: "Ride started", expired: "Search expired",
  requested: "Looking for a verified female driver",
  driver_assigned: "Driver assigned",
  driver_arriving: "Driver arriving",
  ride_started: "Ride started",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_FLOW: RideStatus[] = [
  "requested",
  "driver_assigned",
  "driver_arriving",
  "ride_started",
  "completed",
];

/** MVP estimate: pseudo-distance from text until a maps API is added. */
export function estimateKm(pickup: string, destination: string) {
  const s = `${pickup.trim().toLowerCase()}|${destination.trim().toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 3 + (h % 18);
}

export function estimateFare(v: Vehicle, pickup: string, destination: string) {
  if (!pickup.trim() || !destination.trim()) return 0;
  const cfg = VEHICLES.find((x) => x.id === v)!;
  return Math.round((cfg.base + cfg.perKm * estimateKm(pickup, destination)) / 10) * 10;
}

export const pkr = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export type FareSetting = { vehicle: Vehicle; base_fare: number; per_km: number; per_min: number; min_fare: number };

/** Admin-configured fares (no invented defaults). */
export function useFares() {
  return useQuery({
    queryKey: ["fare_settings"],
    queryFn: async () => ((await supabase.from("fare_settings").select("*")).data ?? []) as FareSetting[],
  });
}

/** Same formula as the database trigger. Returns null when fares aren't configured. */
export function routeFare(f: FareSetting | undefined, km: number, min: number) {
  if (!f) return null;
  return Math.max(f.min_fare, Math.round((f.base_fare + f.per_km * km + f.per_min * min) / 10) * 10);
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      const role = r.includes("admin") ? "admin" : r.includes("driver") ? "driver" : "rider";
      return { user: u.user, role: role as "admin" | "driver" | "rider", profile };
    },
  });
}
