import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_rides",
  title: "List my rides",
  description: "List the signed-in rider's recent Pink Wheel ride bookings with status and fare.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Max rides to return (default 10).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("ride_requests")
      .select("booking_code, pickup, destination, ride_date, ride_time, vehicle, fare, status, driver_name, created_at")
      .eq("rider_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) throw new ToolError(error.message);
    const rides = (data ?? []).map((r) => ({
      booking_code: r.booking_code, pickup: r.pickup, destination: r.destination,
      ride_date: r.ride_date, ride_time: r.ride_time, vehicle: r.vehicle, fare_pkr: r.fare,
      status: r.status, driver_name: r.driver_name,
    }));
    return {
      content: [{ type: "text", text: rides.length ? JSON.stringify(rides) : "No rides yet." }],
      structuredContent: { rides },
    };
  },
});
