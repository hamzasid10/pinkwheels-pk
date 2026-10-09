import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const matchPoolRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(5, "Describe your trip a bit more").max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: routes, error } = await context.supabase
      .from("pool_routes")
      .select("id, driver_id, start_location, destination, departure_date, departure_time, flexible_minutes, available_seats, max_route_deviation, price_per_seat, vehicle_kind")
      .in("status", ["open", "almost_full"])
      .gt("available_seats", 0)
      .gte("departure_date", today)
      .order("departure_date")
      .limit(60);
    if (error) return { ok: false as const, error: "Couldn't load routes." };
    const list = (routes ?? []).filter((r) => r.driver_id !== context.userId).map(({ driver_id: _d, ...r }) => r);
    if (list.length === 0) return { ok: true as const, pickup: "", dropoff: "", time_hint: null, matches: [] };
    const { matchRoutesWithAI, GatewayError } = await import("./ai/pool-match.server");
    try {
      const res = await matchRoutesWithAI(data.query, list, today);
      return { ok: true as const, ...res };
    } catch (e) {
      return { ok: false as const, error: e instanceof GatewayError ? e.message : "Couldn't match routes right now." };
    }
  });
