import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in user's account and personal data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { confirm: string }) => {
    if (d?.confirm !== "DELETE") throw new Error("Please type DELETE to confirm");
    return d;
  })
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const gone = "Deleted user";

    // Cancel anything still in progress
    await db.from("ride_requests").update({ status: "cancelled" }).eq("rider_id", uid).in("status", ["requested", "searching", "offered", "driver_assigned", "accepted", "driver_arriving", "arrived"]);
    await db.from("pool_seat_requests").update({ request_status: "cancelled" }).eq("rider_id", uid).in("request_status", ["pending", "accepted"]);
    await db.from("pool_routes").update({ status: "cancelled" }).eq("driver_id", uid).in("status", ["open", "almost_full", "full"]);

    // Remove personal details from past trips
    await db.from("ride_requests").update({ rider_name: gone, rider_phone: "", emergency_contact: "" }).eq("rider_id", uid);
    await db.from("ride_requests").update({ driver_name: gone, driver_phone: "" }).eq("driver_id", uid);
    await db.from("pool_seat_requests").update({ rider_first_name: gone, emergency_contact: "" }).eq("rider_id", uid);
    await db.from("pool_routes").update({ driver_first_name: gone }).eq("driver_id", uid);

    // Delete personal records and driver documents
    const { data: files } = await db.storage.from("driver-docs").list(uid, { limit: 100 });
    if (files?.length) await db.storage.from("driver-docs").remove(files.map((f) => `${uid}/${f.name}`));
    await db.from("driver_documents").delete().eq("driver_id", uid);
    await db.from("driver_locations").delete().eq("driver_id", uid);
    await db.from("emergency_contacts").delete().eq("user_id", uid);
    await db.from("saved_locations").delete().eq("user_id", uid);
    await db.from("riders").delete().eq("user_id", uid);
    await db.from("drivers").update({
      full_name: gone, phone: "", email: "", cnic: "", licence_no: "", emergency_contact: null,
      working_hours: null, status: "suspended", online: false,
    }).eq("user_id", uid);

    await db.from("user_roles").delete().eq("user_id", uid);
    await db.from("profiles").delete().eq("id", uid);

    // Finally remove the sign-in account 
    const { error } = await db.auth.admin.deleteUser(uid);
    if (error) throw new Error("We couldn't delete your account. Please contact support.");
    return { ok: true };
  });
