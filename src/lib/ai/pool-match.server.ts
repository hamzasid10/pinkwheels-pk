import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

const matchSchema = z.object({
  pickup: z.string(),
  dropoff: z.string(),
  time_hint: z.string().nullable(),
  matches: z.array(z.object({ route_id: z.string(), score: z.number(), reason: z.string() })),
});
export type PoolMatchResult = z.infer<typeof matchSchema>;

export type RouteForMatch = {
  id: string; start_location: string; destination: string; departure_date: string;
  departure_time: string; flexible_minutes: number; available_seats: number;
  max_route_deviation: number; price_per_seat: number; vehicle_kind: string;
};

export class GatewayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function matchRoutesWithAI(query: string, routes: RouteForMatch[], today: string): Promise<PoolMatchResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(401, "AI matching isn't configured yet.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions:
      `You match a rider's trip request to shared car-pool routes in Pakistani cities (mostly Lahore, Karachi, Islamabad). Today is ${today}.
Extract the rider's pickup, drop-off and any time hint (or null). Then rank ONLY the routes provided that genuinely suit her:
- same general direction; pickup near the route's start or along the way; drop-off near the destination or along the way
- use your knowledge of local neighbourhoods and roads (e.g. Lake City → DHA Phase 8 passes Raiwind Rd / Ring Road)
- respect time hints against departure time ± flexible minutes; seats must be > 0
Score 0–100. Return at most 6 matches with score >= 40, best first. reason: one short friendly sentence (max 20 words) explaining the fit.
Use route ids exactly as given. If none fit, return an empty matches list.`,
    messages: [{
      role: "user",
      content: `Rider request: """${query}"""\n\nRoutes (JSON):\n${JSON.stringify(routes)}`,
    }],
    output: Output.object({ schema: matchSchema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    const out = await result.output;
    const ids = new Set(routes.map((r) => r.id));
    return {
      ...out,
      matches: out.matches
        .filter((m) => ids.has(m.route_id))
        .map((m) => ({ ...m, score: Math.max(0, Math.min(100, Math.round(m.score))), reason: m.reason.slice(0, 200) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
    };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 500;
    if (status === 429) throw new GatewayError(429, "AI matching is busy right now. Please try again in a moment.");
    if (status === 402) throw new GatewayError(402, "AI matching is paused: the app's AI credits have run out.");
    if (status === 403) throw new GatewayError(403, "AI matching isn't available for this app right now.");
    console.error("pool match failed", e);
    throw new GatewayError(500, "Couldn't match routes right now. Try the filters instead.");
  }
}
