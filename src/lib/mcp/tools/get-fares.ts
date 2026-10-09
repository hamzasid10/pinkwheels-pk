import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_fares",
  title: "Get ride fares",
  description: "Get the current Pink Wheel fare rates in PKR for each vehicle type (car, scooty, bike).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("fare_settings").select("vehicle, base_fare, per_km, per_min, min_fare");
    if (error) throw new ToolError(error.message);
    const fares = data ?? [];
    return {
      content: [{ type: "text", text: fares.length ? JSON.stringify(fares) : "Fares have not been set yet." }],
      structuredContent: { fares },
    };
  },
});
