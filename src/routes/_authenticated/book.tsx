import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, History, ShieldCheck, Users, Route as RouteIcon } from "lucide-react";
import { AppShell, Logo, Panel, SafetyActions, StatusPill } from "@/components/Brand";
import { GoogleMap, type MapPin } from "@/components/maps/GoogleMap";
import { PlaceInput, type Place } from "@/components/maps/PlaceInput";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { computeRoute, nearbyDrivers, reverseGeocode } from "@/lib/maps/maps.functions";
import { inServiceArea } from "@/lib/maps/cities";
import { pkr, routeFare, useFares, useMe, VEHICLES, type Vehicle, type RideStatus } from "@/lib/pink";
import { cn } from "@/lib/utils";
import { MobileMenu } from "@/components/MobileMenu";
import rideCar from "@/assets/ride-car.png";
import rideScooty from "@/assets/ride-scooty.png";
import rideBike from "@/assets/ride-bike.png";

const vehicleImages = { car: rideCar, scooty: rideScooty, bike: rideBike };

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a Ride — Pink Wheel" },
      { name: "description", content: "Pick your pickup and drop-off on the map and ride with a verified female driver." },
      { property: "og:title", content: "Book a Ride — Pink Wheel" },
      { property: "og:description", content: "Live map booking with verified female drivers in Lahore, Gujranwala, Islamabad and Rawalpindi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: BookPage,
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
  const [f, setF] = useState({ ride_date: today, ride_time: now.toTimeString().slice(0, 5) });
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const name = me.data?.profile?.full_name || "";
  const phone = me.data?.profile?.phone || "";
  const uid = me.data?.user.id;
  const ec = useQuery({
    queryKey: ["my-emergency-contact", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("emergency_contacts").select("name, phone").eq("user_id", uid!).order("created_at").limit(1)).data?.[0] ?? null,
  });
  const mode = vehicle === "car" ? "DRIVE" : "TWO_WHEELER";

  useEffect(() => {
    if (!pickup || !drop) { setInfo(null); setRouting(false); return; }
    let live = true;
    setInfo(null);
    setRouting(true);
    route({ data: { from: pickup, to: drop, mode } })
      .then((r) => live && setInfo(r))
      .catch((e) => { if (live) { setInfo(null); toast.error((e as Error).message); } })
      .finally(() => live && setRouting(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, mode]);

  useEffect(() => {
    if (!booked || booked.pickup_lat == null || booked.pickup_lng == null) return;
    const pos = { lat: booked.pickup_lat, lng: booked.pickup_lng };
    const load = () => nearby({ data: pos }).then((d) => setDots(d as typeof dots)).catch(() => {});
    load(); const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booked?.id]);

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
    const bp: MapPin[] = [];
    if (booked.pickup_lat != null && booked.pickup_lng != null) bp.push({ id: "pickup", pos: { lat: booked.pickup_lat, lng: booked.pickup_lng }, kind: "pickup" });
    if (booked.dest_lat != null && booked.dest_lng != null) bp.push({ id: "dropoff", pos: { lat: booked.dest_lat, lng: booked.dest_lng }, kind: "dropoff" });
    dots.forEach((d, i) => bp.push({ id: `n${i}`, pos: { lat: d.lat, lng: d.lng }, kind: (d.vehicle ?? "car") as MapPin["kind"], label: "Nearby driver" }));
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
          <div className="mt-4 flex items-center justify-between rounded-xl bg-accent/50 px-3 py-2 text-sm"><span className="font-semibold">Finding riders near you</span><span className="text-muted-foreground">{dots.length} within 8 km</span></div>
          <GoogleMap className="mt-2 h-72" pins={bp} fitKey={`booked-${dots.length}`} />
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
    <div className="rider-booking bg-background">
      <header className="rider-map-header border-b bg-card">
        <div className="flex min-w-0 items-center gap-1"><MobileMenu /><Logo /></div>
        <Button asChild variant="ghost" size="sm"><Link to="/rider"><History /> My rides</Link></Button>
      </header>
      <main className="rider-map-main">
        <GoogleMap className="rider-live-map" pins={pins} polyline={info?.polyline} onPinDrag={onDrag}
          fitKey={`${pickup?.lat},${drop?.lat},${info?.polyline?.length}`} />
        <form onSubmit={submit} className="rider-booking-form">
          <section aria-label="Your route" className="rider-addresses bg-card shadow-card">
            <div className="space-y-2">
              <PlaceInput value={pickup} onChange={setPickup} placeholder="Pickup location" allowGps dot="pickup" />
              <PlaceInput value={drop} onChange={setDrop} placeholder="Where to?" near={pickup ?? undefined} dot="dropoff" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Women moving women</span>
              {routing ? <span role="status">Finding route…</span> : info ? <span>{info.distanceKm} km · {info.durationMin} min</span> : <span>Pakistan</span>}
            </div>
          </section>
          <section aria-label="Choose your ride" className="rider-ride-sheet bg-card shadow-card">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border md:hidden" />
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h1 className="font-sans text-xl font-bold">Choose your ride</h1><p className="mt-0.5 text-xs text-muted-foreground">{pickup && drop ? "Your next journey" : `Where to, ${(name || "rider").split(" ")[0]}?`}</p></div>
              {info && <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground"><Clock className="h-3.5 w-3.5" />{info.durationMin} min trip</span>}
            </div>
            <div role="group" aria-label="Vehicle options" className="space-y-2">
              {VEHICLES.map((v) => {
                const fv = fareFor(v.id);
                return (
                  <Button variant="ghost" type="button" key={v.id} aria-pressed={vehicle === v.id} onClick={() => setVehicle(v.id)}
                    className={cn("ride-option h-auto w-full justify-start gap-3 whitespace-normal rounded-2xl border-2 px-3 py-2.5 text-left", vehicle === v.id ? "border-primary bg-accent/40" : "border-transparent bg-card hover:bg-muted")}>
                    <img src={vehicleImages[v.id]} alt="" width={816} height={816} loading="lazy" className="h-16 w-20 shrink-0 object-contain" />
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-base font-bold">{v.label}<span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground"><Users className="h-3 w-3" />{v.id === "car" ? "4" : "1"}</span></span><span className="mt-1 block text-xs font-normal text-muted-foreground">{v.id === "car" ? "Room to relax · AC comfort" : v.id === "scooty" ? "Light & easy city travel" : "A quick city ride"}</span></span>
                    <span className="shrink-0 text-right"><span className="block text-sm font-bold">{fv != null ? pkr(fv) : "—"}</span><span className="mt-1 block max-w-20 text-[10px] font-normal text-muted-foreground">{!info ? "Set your route" : fv == null ? "Fare not set" : "Cash fare"}</span></span>
                  </Button>
                );
              })}
            </div>
            <Button variant="ghost" className="mt-2 w-full justify-between rounded-xl border-t text-sm" asChild><Link to="/pool"><span className="flex items-center gap-2"><Users className="text-primary" /> Pink Pool · Shared rides</span><RouteIcon /></Link></Button>
            <details className="rider-trip-details mt-3 border-t pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Trip & contact details<ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
              <div className="mt-3 space-y-3 pb-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="ride-date">Date</Label><Input id="ride-date" type="date" min={today} value={f.ride_date} onChange={set("ride_date")} /></div>
                  <div><Label htmlFor="ride-time">Time</Label><Input id="ride-time" type="time" value={f.ride_time} onChange={set("ride_time")} /></div>
                </div>
                <div><Label htmlFor="rider-name">Rider name</Label><Input id="rider-name" value={name} onChange={set("rider_name")} /></div>
                <div><Label htmlFor="rider-phone">Phone number</Label><Input id="rider-phone" type="tel" value={phone} onChange={set("rider_phone")} /></div>
                <div><Label htmlFor="emergency-contact">Emergency contact (name & phone)</Label><Input id="emergency-contact" value={f.emergency_contact} onChange={set("emergency_contact")} placeholder="Ammi — 0300 1234567" /></div>
              </div>
            </details>
            <div className="rider-booking-action mt-3 bg-card pt-2">
              <Button type="submit" size="lg" className="w-full" disabled={busy || !ready}>{busy ? "Finding riders…" : fare != null ? `Find Riders · ${pkr(fare)}` : "Find Riders"}</Button>
              {!ready && !busy && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-primary">{routing ? "Finding your route…" : `Complete ${missing.length} required ${missing.length === 1 ? "detail" : "details"}`}</summary><ul className="mt-2 list-disc space-y-1 pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul></details>}
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified female drivers</span><Link to="/safety" className="font-semibold text-primary">Safety</Link></div>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
