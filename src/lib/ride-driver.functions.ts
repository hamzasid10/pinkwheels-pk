import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACTIVE_DRIVER_STATUSES } from "@/lib/ride-dispatch";

/** Only an assigned passenger may view the approved portrait, never identity documents. */
export const assignedDriverPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rideId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ride, error } = await context.supabase.from("ride_requests").select("rider_id,driver_id,status").eq("id", data.rideId).maybeSingle();
    if (error || !ride || ride.rider_id !== context.userId || !ride.driver_id || !ACTIVE_DRIVER_STATUSES.includes(ride.status)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: portrait } = await supabaseAdmin.from("driver_documents").select("file_path").eq("driver_id", ride.driver_id).eq("verified", true).in("doc_type", ["selfie", "photo"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!portrait) return null;
    const { data: signed } = await supabaseAdmin.storage.from("driver-docs").createSignedUrl(portrait.file_path, 300);
    return signed?.signedUrl ?? null;
  });