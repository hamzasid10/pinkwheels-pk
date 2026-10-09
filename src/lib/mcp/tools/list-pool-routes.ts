import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pool_routes",
  title: "List Pink Pool routes",
  description: "List upcoming open Pink Pool shared routes with seats and price per seat, optionally filtered by place text.",
  inputSchema: {
    search: z.string().trim().max(100).optional().describe("Text to match in start or destination, e.g. 'DHA'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("pool_routes")
      .select("id, start_location, destination, departure_date, departure_time, available_seats, price_per_seat, vehicle_kind, driver_first_name, driver_rating, status")
      .in("status", ["open", "almost_full"])
      .gte("departure_date", new Date().toISOString().slice(0, 10))
      .order("departure_date")
      .limit(25);
    if (search) {
      const s = search.replace(/[%,()]/g, " ");
      q = q.or(`start_location.ilike.%${s}%,destination.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const routes = (data ?? []).map((r) => ({ ...r, price_per_seat_pkr: r.price_per_seat }));
    return {
      content: [{ type: "text", text: routes.length ? JSON.stringify(routes) : "No open routes found." }],
      structuredContent: { routes },
    };
  },
});
