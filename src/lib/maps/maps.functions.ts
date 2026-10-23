import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mapsFetch } from "./gateway.server";
import { SERVICE_BOUNDS } from "./cities";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const placeAutocomplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ input: z.string().trim().min(2).max(120), sessionToken: z.string().uuid(), near: latLng.optional() }).parse(d))
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      input: data.input,
      sessionToken: data.sessionToken,
      includedRegionCodes: ["pk"],
      languageCode: "en",
      locationBias: data.near
        ? { circle: { center: { latitude: data.near.lat, longitude: data.near.lng }, radius: 30000 } }
        : { rectangle: SERVICE_BOUNDS },
    };
    const j = await mapsFetch("/places/v1/places:autocomplete", {
      body,
      fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
    });
    type S = { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } };
    return ((j.suggestions ?? []) as S[]).filter((s) => s.placePrediction).slice(0, 6).map((s) => ({
      placeId: s.placePrediction!.placeId,
      main: s.placePrediction!.structuredFormat?.mainText?.text ?? s.placePrediction!.text?.text ?? "",
      secondary: s.placePrediction!.structuredFormat?.secondaryText?.text ?? "",
      text: s.placePrediction!.text?.text ?? "",
    }));
  });

export const placeDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ placeId: z.string().min(5).max(300).regex(/^[A-Za-z0-9_-]+$/), sessionToken: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }) => {
    const qs = data.sessionToken ? `?sessionToken=${data.sessionToken}` : "";
    const j = await mapsFetch(`/places/v1/places/${data.placeId}${qs}`, { fieldMask: "id,displayName,formattedAddress,location" });
    return {
      placeId: j.id as string,
      address: [j.displayName?.text, j.formattedAddress].filter(Boolean).join(", ") as string,
      lat: j.location.latitude as number,
      lng: j.location.longitude as number,
    };
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => latLng.parse(d))
  .handler(async ({ data }) => {
    const j = await mapsFetch(`/maps/api/geocode/json?latlng=${data.lat},${data.lng}&region=pk&language=en`);
    const r = j.results?.[0];
    return { address: (r?.formatted_address as string) ?? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`, placeId: (r?.place_id as string) ?? null };
  });

export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: latLng, to: latLng, mode: z.enum(["DRIVE", "TWO_WHEELER"]).default("DRIVE") }).parse(d))
  .handler(async ({ data }) => {
    const call = (mode: string) => mapsFetch("/routes/directions/v2:computeRoutes", {
      body: {
        origin: { location: { latLng: { latitude: data.from.lat, longitude: data.from.lng } } },
        destination: { location: { latLng: { latitude: data.to.lat, longitude: data.to.lng } } },
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        regionCode: "pk",
        units: "METRIC",
      },
      fieldMask: "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    });
    let j = await call(data.mode).catch(() => null);
    if (!j?.routes?.length && data.mode !== "DRIVE") j = await call("DRIVE");
    const r = j?.routes?.[0];
    if (!r?.polyline?.encodedPolyline || typeof r.duration !== "string") throw new Error("No driving route found between these points.");
    return {
      distanceKm: Math.round(((r.distanceMeters ?? 0) / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(parseFloat(r.duration) / 60)),
      polyline: r.polyline.encodedPolyline as string,
    };
  });

export const nearbyDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => latLng.parse(d))
  .handler(async ({ data, context }) => {
    const { data: setting } = await context.supabase.from("app_settings").select("dispatch_radius_km").limit(1).maybeSingle();
    const { data: rows, error } = await context.supabase.rpc("nearby_drivers", { _lat: data.lat, _lng: data.lng, _radius_km: setting?.dispatch_radius_km ?? 10 });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
