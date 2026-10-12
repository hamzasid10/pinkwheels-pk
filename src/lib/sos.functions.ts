import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SosInput = { rideId?: string | null; lat?: number | null; lng?: number | null; note?: string };

/**
 * Records an SOS alert for the admin team, then forwards a WhatsApp message to the
 * safety number. WhatsApp failures never block the saved alert.
 */
export const sendSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SosInput) => {
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const lat = num(d?.lat);
    const lng = num(d?.lng);
    return {
      rideId: typeof d?.rideId === "string" && /^[0-9a-f-]{36}$/i.test(d.rideId) ? d.rideId : null,
      lat: lat !== null && Math.abs(lat) <= 90 ? lat : null,
      lng: lng !== null && Math.abs(lng) <= 180 ? lng : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const role = roles?.some((r) => r.role === "driver") ? "Driver" : "Rider";

    let ride: {
      booking_code: string; pickup: string; destination: string; rider_name: string; rider_phone: string;
      driver_name: string | null; driver_phone: string | null; driver_vehicle: string | null; status: string;
    } | null = null;
    if (data.rideId) {
      const { data: r } = await supabase
        .from("ride_requests")
        .select("booking_code, pickup, destination, rider_name, rider_phone, driver_name, driver_phone, driver_vehicle, status")
        .eq("id", data.rideId)
        .maybeSingle();
      ride = r;
    }

    // Always save the alert first so it appears on the admin Emergency tab.
    const { error: saveError } = await supabase.from("complaints").insert({
      user_id: userId,
      ride_id: data.rideId,
      kind: "emergency",
      message: `SOS button pressed by ${role}${data.lat !== null ? ` at ${data.lat.toFixed(5)}, ${data.lng?.toFixed(5)}` : ""}`,
    });
    if (saveError) throw new Error("Could not record SOS");

    // WhatsApp alert (best effort)
    let whatsapp: "sent" | "failed" | "not_configured" = "not_configured";
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const twilioKey = process.env["TWILIO_API_KEY"];
    if (lovableKey && twilioKey) {
      const to = process.env["SOS_WHATSAPP_TO"] || "+923406289894";
      // Twilio's shared WhatsApp sandbox number by default (test mode).
      const from = process.env["TWILIO_WHATSAPP_FROM"] || "+14155238886";
      const mapLink = data.lat !== null && data.lng !== null ? `https://maps.google.com/?q=${data.lat},${data.lng}` : "Location not available";
      const lines = [
        "🚨 PINK WHEEL SOS ALERT",
        `${role}: ${profile?.full_name || "Unknown"}${profile?.phone ? ` (${profile.phone})` : ""}`,
        ride ? `Ride: ${ride.booking_code} (${ride.status})` : "Ride: none linked",
        ride ? `Pickup: ${ride.pickup}` : "",
        ride ? `Drop-off: ${ride.destination}` : "",
        ride ? `Rider: ${ride.rider_name} ${ride.rider_phone}` : "",
        ride?.driver_name ? `Driver: ${ride.driver_name} ${ride.driver_phone ?? ""} ${ride.driver_vehicle ?? ""}`.trim() : "",
        `Location: ${mapLink}`,
        `Time: ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT`,
      ].filter(Boolean);
      try {
        const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": twilioKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: lines.join("\n") }),
        });
        if (res.ok) whatsapp = "sent";
        else {
          whatsapp = "failed";
          console.error(`SOS WhatsApp failed [${res.status}]: ${await res.text()}`);
        }
      } catch (e) {
        whatsapp = "failed";
        console.error("SOS WhatsApp error", e);
      }
    }
    return { saved: true, whatsapp };
  });
