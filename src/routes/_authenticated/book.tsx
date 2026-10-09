import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Clock, Route as RouteIcon } from "lucide-react";
import { AppShell, Panel, SafetyActions, StatusPill } from "@/components/Brand";
import { GoogleMap, type MapPin } from "@/components/maps/GoogleMap";
import { PlaceInput, type Place } from "@/components/maps/PlaceInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { computeRoute, nearbyDrivers, reverseGeocode } from "@/lib/maps/maps.functions";
import { inServiceArea } from "@/lib/maps/cities";
import { pkr, routeFare, useFares, useMe, VEHICLES, type Vehicle, type RideStatus } from "@/lib/pink";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a Ride — Pink Wheel" },
      { name: "description", content: "Pick your pickup and drop-off on the map and ride with a verified female driver." },
      { property: "og:title", content: "Book a Ride — Pink Wheel" },
      { property: "og:description", content: "Live map booking with verified female drivers in Lahore, Gujranwala, Islamabad and Rawalpindi." },
    ],
  }),
  component: BookPage,
});

const schema = z.object({
  ride_date: z.string().min(1, "Pick a date"),
  ride_time: z.string().min(1, "Pick a time"),
  rider_name: z.string().trim().min(2, "Enter your name").max(100),
  rider_phone: z.string().trim().min(7, "Enter phone").max(20),
  emergency_contact: z.string().trim().min(7, "Enter emergency contact").max(120),
});

type Booked = { id: string; booking_code: string; pickup: string; destination: string; vehicle: Vehicle; fare: number; status: RideStatus; trip_pin: string; route_polyline: string | null; pickup_lat: number | null; pickup_lng: number | null; dest_lat: number | null; dest_lng: number | null };
type RouteInfo = { distanceKm: number; durationMin: number; polyline: string };

function BookPage() {
  const me = useMe();
  const fares = useFares();
  const route = useServerFn(computeRoute);
  const rev = useServerFn(reverseGeocode);
  const nearby = useServerFn(nearbyDrivers);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [vehicle, setVehicle] = useState<Vehicle>("car");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(null);
  const [info, setInfo] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [dots, setDots] = useState<{ lat: number; lng: number; vehicle: Vehicle | null }[]>([]);
  const [f, setF] = useState({ ride_date: today, ride_time: now.toTimeString().slice(0, 5), rider_name: "", rider_phone: "", emergency_contact: "" });
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const name = f.rider_name || me.data?.profile?.full_name || "";
  const phone = f.rider_phone || me.data?.profile?.phone || "";
  const mode = vehicle === "car" ? "DRIVE" : "TWO_WHEELER";

  useEffect(() => {
    if (!pickup || !drop) { setInfo(null); return; }
    let live = true;
    setRouting(true);
    route({ data: { from: pickup, to: drop, mode } })
      .then((r) => live && setInfo(r))
      .catch((e) => { if (live) { setInfo(null); toast.error((e as Error).message); } })
      .finally(() => live && setRouting(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, mode]);

  useEffect(() => {
    if (!pickup) return;
    nearby({ data: { lat: pickup.lat, lng: pickup.lng } }).then((d) => setDots(d as typeof dots)).catch(() => setDots([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng]);

  const pins = useMemo<MapPin[]>(() => [
    ...dots.map((d, i) => ({ id: `d${i}`, pos: { lat: d.lat, lng: d.lng }, kind: (d.vehicle ?? "car") as MapPin["kind"], label: "Available driver" })),
    ...(pickup ? [{ id: "pickup", pos: pickup, kind: "pickup" as const, draggable: true, label: "Pickup" }] : []),
    ...(drop ? [{ id: "dropoff", pos: drop, kind: "dropoff" as const, draggable: true, label: "Drop-off" }] : []),
  ], [dots, pickup, drop]);

  async function onDrag(id: string, pos: { lat: number; lng: number }) {
    try {
      const r = await rev({ data: pos });
      const p = { ...pos, address: r.address, placeId: r.placeId };
      if (id === "pickup") setPickup(p); else if (id === "dropoff") setDrop(p);
    } catch (e) { toast.error((e as Error).message); }
  }

  const fareFor = (v: Vehicle) => info ? routeFare(fares.data?.find((x) => x.vehicle === v), info.distanceKm, info.durationMin) : null;
  const fare = fareFor(vehicle);
  const vLabel = VEHICLES.find((v) => v.id === vehicle)?.label ?? "this vehicle";
  const missing: string[] = [];
  if (!pickup) missing.push("Pickup — pick an address from the suggestions or tap the location button");
  if (!drop) missing.push("Drop-off — pick an address from the suggestions");
  if (pickup && drop && !routing && !info) missing.push("Route — we couldn't find a driving route; try moving a pin");
  if (pickup && !inServiceArea(pickup)) missing.push("Pickup must be in Lahore, Gujranwala, Islamabad or Rawalpindi");
  if (drop && !inServiceArea(drop)) missing.push("Drop-off must be in Lahore, Gujranwala, Islamabad or Rawalpindi");
  if (info && !fares.isLoading && fare == null) missing.push(`Fare — prices for ${vLabel} haven't been set by Pink Wheel yet`);
  if (!f.ride_date || !f.ride_time) missing.push("Date and time");
  if (name.trim().length < 2) missing.push("Rider name");
  if (phone.trim().length < 7) missing.push("Phone number");
  if (f.emergency_contact.trim().length < 7) missing.push("Emergency contact (name & phone)");
  const ready = missing.length === 0 && !routing && !!info && fare != null && !!me.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickup || !drop) return toast.error("Choose pickup and drop-off");
    if (!inServiceArea(pickup) || !inServiceArea(drop)) return toast.error("We currently serve Lahore, Gujranwala, Islamabad and Rawalpindi only.");
    if (!info) return toast.error("Waiting for the route…");
    if (fare == null) return toast.error("Fares for this vehicle are not set yet.");
    const parsed = schema.safeParse({ ...f, rider_name: name, rider_phone: phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    if (!me.data || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("ride_requests")
      .insert({
        ...parsed.data, vehicle, fare, rider_id: me.data.user.id,
        pickup: pickup.address, destination: drop.address,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dest_lat: drop.lat, dest_lng: drop.lng,
        pickup_place_id: pickup.placeId, dest_place_id: drop.placeId,
        distance_km: info.distanceKm, duration_min: info.durationMin, route_polyline: info.polyline,
      })
      .select("id, booking_code, pickup, destination, vehicle, fare, status, trip_pin, route_polyline, pickup_lat, pickup_lng, dest_lat, dest_lng")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message.includes("Fares") ? "Fares for this vehicle aren't set yet." : "Couldn't book your ride. Please try again.");
    setBooked(data as Booked);
  }

  if (booked) {
    const bp: MapPin[] = booked.pickup_lat != null ? [
      { id: "pickup", pos: { lat: booked.pickup_lat, lng: booked.pickup_lng! }, kind: "pickup" },
      { id: "dropoff", pos: { lat: booked.dest_lat!, lng: booked.dest_lng! }, kind: "dropoff" },
    ] : [];
    return (
      <AppShell title="Ride booked">
        <Panel className="mx-auto max-w-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Booking ID</p>
              <p className="font-display text-2xl font-semibold">{booked.booking_code}</p>
            </div>
          </div>
          <GoogleMap className="mt-4 h-56" pins={bp} polyline={booked.route_polyline} fitKey="booked" />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Pickup</dt><dd className="font-medium">{booked.pickup}</dd></div>
            <div><dt className="text-muted-foreground">Destination</dt><dd className="font-medium">{booked.destination}</dd></div>
            <div><dt className="text-muted-foreground">Vehicle</dt><dd className="font-medium capitalize">{booked.vehicle}</dd></div>
            <div><dt className="text-muted-foreground">Estimated fare (cash)</dt><dd className="font-medium">{pkr(booked.fare)}</dd></div>
            <div><dt className="text-muted-foreground">Trip PIN</dt><dd className="font-display text-xl tracking-[0.3em]">{booked.trip_pin}</dd></div>
          </dl>
          <div className="mt-4"><StatusPill status={booked.status} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Once a driver is assigned you can follow her live on your dashboard.</p>
          <div className="mt-5"><SafetyActions rideId={booked.id} shareText={`I'm booking a Pink Wheel ride ${booked.booking_code}: ${booked.pickup} → ${booked.destination}`} /></div>
          <Button className="mt-5 w-full" variant="hero" asChild><Link to="/rider">Track on my dashboard</Link></Button>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Book a ride">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_380px]">
        <GoogleMap className="h-[42vh] min-h-[280px] shadow-card md:sticky md:top-20 md:h-[calc(100vh-7rem)]"
          pins={pins} polyline={info?.polyline} onPinDrag={onDrag} fitKey={`${pickup?.lat},${drop?.lat},${info?.polyline?.length}`} />
        <div className="-mt-10 space-y-4 rounded-t-3xl bg-background pt-4 md:mt-0 md:pt-0">
          <Panel>
            <div className="space-y-2">
              <PlaceInput value={pickup} onChange={setPickup} placeholder="Pickup location" allowGps dot="pickup" />
              <PlaceInput value={drop} onChange={setDrop} placeholder="Where to?" near={pickup ?? undefined} dot="dropoff" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Drag the pins on the map to fine-tune. Serving Lahore, Gujranwala, Islamabad & Rawalpindi.</p>
            {(info || routing) && (
              <div className="mt-3 flex gap-4 rounded-2xl bg-accent px-4 py-3 text-sm">
                {routing ? <span>Finding the best route…</span> : info && <>
                  <span className="flex items-center gap-1.5"><RouteIcon className="h-4 w-4 text-primary" />{info.distanceKm} km</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />~{info.durationMin} min</span>
                </>}
              </div>
            )}
          </Panel>
          <Panel title="Choose vehicle">
            <div className="space-y-2">
              {VEHICLES.map((v) => {
                const fv = fareFor(v.id);
                return (
                  <button type="button" key={v.id} onClick={() => setVehicle(v.id)}
                    className={cn("flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition", vehicle === v.id ? "border-primary bg-accent" : "border-border bg-card")}>
                    <span><span className="block font-semibold">{v.label}</span><span className="block text-xs text-muted-foreground">{v.desc}</span></span>
                    <span className="text-right font-display text-lg font-semibold">
                      {!info ? "—" : fv == null ? <span className="text-xs font-normal text-muted-foreground">Fare not set yet</span> : pkr(fv)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Estimate from distance and travel time. Pay your driver in cash.</p>
          </Panel>
          <Panel title="When & who">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" min={today} value={f.ride_date} onChange={set("ride_date")} /></div>
                <div><Label>Time</Label><Input type="time" value={f.ride_time} onChange={set("ride_time")} /></div>
              </div>
              <div><Label>Rider name</Label><Input value={name} onChange={set("rider_name")} /></div>
              <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={set("rider_phone")} /></div>
              <div><Label>Emergency contact (name & phone)</Label><Input value={f.emergency_contact} onChange={set("emergency_contact")} placeholder="e.g. Ammi — 0300 1234567" /></div>
            </div>
          </Panel>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy || !ready}>
            {busy ? "Booking…" : fare != null ? `Book ${VEHICLES.find((v) => v.id === vehicle)?.label} · ${pkr(fare)}` : "Book Ride"}
          </Button>
          {!ready && !busy && (
            <div role="status" className="rounded-2xl border border-dashed border-primary/40 bg-accent/50 px-4 py-3 text-sm">
              <p className="font-semibold">{routing ? "Finding the best route…" : "Still needed before you can book:"}</p>
              {!routing && <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            </div>
          )}
        </div>
      </form>
    </AppShell>
  );
}
