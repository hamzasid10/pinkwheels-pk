import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPlaceholder } from "@/components/Brand";
import { GoogleMap, type MapPin } from "@/components/maps/GoogleMap";
import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/lib/maps/cities";
import { ACTIVE_DRIVER_STATUSES } from "@/lib/ride-dispatch";

type RideLike = {
  id: string; pickup: string; destination: string; driver_id?: string | null; status?: string;
  pickup_lat?: number | null; pickup_lng?: number | null; dest_lat?: number | null; dest_lng?: number | null; route_polyline?: string | null;
};

const TRACKABLE = ACTIVE_DRIVER_STATUSES;

/** Map of a ride; when a driver is assigned it follows her live location. */
export function RideMap({ ride, className = "h-60", track = true }: { ride: RideLike; className?: string; track?: boolean }) {
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const live = track && !!ride.driver_id && TRACKABLE.includes(ride.status ?? "");

  useEffect(() => {
    if (!live) { setDriverPos(null); return; }
    const id = ride.driver_id;
    if (!id) return;
    supabase.from("driver_locations").select("lat,lng,updated_at").eq("driver_id", id).maybeSingle()
      .then(({ data }) => { if (data) { setDriverPos({ lat: data.lat, lng: data.lng }); setUpdated(data.updated_at); } });
    const ch = supabase.channel(`loc-${ride.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${id}` }, (p) => {
        const n = p.new as { lat: number; lng: number; updated_at: string };
        if (n?.lat != null) { setDriverPos({ lat: n.lat, lng: n.lng }); setUpdated(n.updated_at); }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [live, ride.driver_id, ride.id]);

  const pins = useMemo<MapPin[]>(() => {
    const out: MapPin[] = [];
    if (ride.pickup_lat != null && ride.pickup_lng != null) out.push({ id: "pickup", pos: { lat: ride.pickup_lat, lng: ride.pickup_lng }, kind: "pickup" });
    if (ride.dest_lat != null && ride.dest_lng != null) out.push({ id: "dropoff", pos: { lat: ride.dest_lat, lng: ride.dest_lng }, kind: "dropoff" });
    if (driverPos) out.push({ id: "driver", pos: driverPos, kind: "driver", label: "Your driver" });
    return out;
  }, [ride, driverPos]);

  if (ride.pickup_lat == null) return <MapPlaceholder from={ride.pickup} to={ride.destination} />;
  return (
    <div>
      <GoogleMap className={className} pins={pins} polyline={ride.route_polyline} fitKey={`${ride.id}-${!!driverPos}`} />
      {live && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {driverPos && updated ? `Driver location live · updated ${new Date(updated).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" })}` : "Waiting for the driver's live location…"}
        </p>
      )}
    </div>
  );
}

/** Driver side: while enabled, sends her GPS position every ~10s. */
export function useShareLocation(driverId: string | undefined, enabled: boolean) {
  const last = useRef(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !driverId || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(async (pos) => {
      const now = Date.now();
      if (now - last.current < 10000) return;
      last.current = now;
      const { error: e } = await supabase.from("driver_locations").upsert({
        driver_id: driverId, lat: pos.coords.latitude, lng: pos.coords.longitude,
        heading: pos.coords.heading, updated_at: new Date().toISOString(),
      });
      setError(e ? e.message : null);
    }, (e) => {
      const msg = e.code === 1 ? "Location permission denied — riders can't see you on the map." : "Couldn't read your location.";
      setError(msg); toast.error(msg);
    }, { enableHighAccuracy: true, maximumAge: 5000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [enabled, driverId]);
  return error;
}
