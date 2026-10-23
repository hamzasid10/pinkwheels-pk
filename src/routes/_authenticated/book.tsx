import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CarFront, ChevronUp, Clock, History, Loader2, ShieldCheck, Users, X } from "lucide-react";
import { Logo, SafetyActions, StatusPill } from "@/components/Brand";
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
  const [snap, setSnap] = useState<"collapsed" | "half" | "full">("half");
  const [safety, setSafety] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    if (!booked || booked.status === "cancelled") return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("ride_requests").select("status").eq("id", booked.id).single();
      if (data && data.status !== booked.status) setBooked((b) => b && { ...b, status: data.status as RideStatus });
    }, 6000);
    return () => clearInterval(t);
  }, [booked?.id, booked?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const ready = missing.length === 0 && !routing && !!info && fare != null && !!me.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickup || !drop) return toast.error("Choose pickup and drop-off");
    if (!inServiceArea(pickup) || !inServiceArea(drop)) return toast.error("We currently serve Lahore, Gujranwala, Islamabad and Rawalpindi only.");
    if (!info) return toast.error("Waiting for the route…");
    if (fare == null) return toast.error("Fares for this vehicle are not set yet.");
    if (!me.data || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("ride_requests")
      .insert({
        ride_date: f.ride_date, ride_time: f.ride_time,
        rider_name: name, rider_phone: phone,
        emergency_contact: ec.data ? `${ec.data.name} — ${ec.data.phone}` : "",
        vehicle, fare, rider_id: me.data.user.id,
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

  async function cancelBooking() {
    if (!booked || cancelling) return;
    setCancelling(true);
    const { error } = await supabase.from("ride_requests").update({ status: "cancelled" }).eq("id", booked.id);
    setCancelling(false);
    if (error) return toast.error("Couldn't cancel. Please try again.");
    toast.success("Ride cancelled");
    setBooked(null);
  }

  const bookedPins: MapPin[] = [];
  if (booked) {
    if (booked.pickup_lat != null && booked.pickup_lng != null) bookedPins.push({ id: "pickup", pos: { lat: booked.pickup_lat, lng: booked.pickup_lng }, kind: "pickup" });
    if (booked.dest_lat != null && booked.dest_lng != null) bookedPins.push({ id: "dropoff", pos: { lat: booked.dest_lat, lng: booked.dest_lng }, kind: "dropoff" });
    dots.forEach((d, i) => bookedPins.push({ id: `n${i}`, pos: { lat: d.lat, lng: d.lng }, kind: (d.vehicle ?? "car") as MapPin["kind"], label: "Nearby driver" }));
  }
  const both = !!pickup && !!drop;
  const searching = booked && booked.status === "requested";
  const cta = fare != null ? `Confirm ${vLabel} — ${pkr(fare)}` : "Confirm Pink Wheel";

  return (
    <div className="rider-booking bg-background">
      <header className="rider-map-header">
        <div className="flex min-w-0 items-center gap-1 rounded-full bg-card py-1 pl-1 pr-3 shadow-card"><MobileMenu /><Logo /></div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Safety" onClick={() => setSafety((v) => !v)} className="map-fab"><ShieldCheck className="h-5 w-5 text-primary" /></button>
          <Button asChild variant="secondary" size="sm" className="rounded-full shadow-card"><Link to="/rider"><History /> My rides</Link></Button>
        </div>
      </header>
      {safety && (
        <div className="animate-fade-in absolute right-3 z-50 w-72 rounded-3xl bg-card p-4 shadow-card md:right-6" style={{ top: "calc(var(--safe-area-top) + 64px)" }}>
          <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Safety tools</p><button type="button" aria-label="Close safety" onClick={() => setSafety(false)}><X className="h-4 w-4" /></button></div>
          <SafetyActions rideId={booked?.id} shareText={booked ? `My Pink Wheel ride ${booked.booking_code}: ${booked.pickup} → ${booked.destination}` : `I'm booking a Pink Wheel ride${pickup && drop ? `: ${pickup.address} → ${drop.address}` : ""}`} />
          <p className="mt-3 text-xs text-muted-foreground">Emergency contact: {ec.data ? `${ec.data.name} · ${ec.data.phone}` : <Link to="/rider" className="text-primary">add one</Link>}</p>
          <Link to="/safety" className="mt-2 block text-xs font-semibold text-primary">Open Safety Center →</Link>
        </div>
      )}
      <main className="rider-map-main">
        <GoogleMap className="rider-live-map" controls
          pins={booked ? bookedPins : pins} polyline={booked ? booked.route_polyline : info?.polyline} onPinDrag={booked ? undefined : onDrag}
          emphasize={both ? vehicle : undefined}
          fitKey={booked ? `booked-${booked.id}` : `${pickup?.lat},${drop?.lat},${info?.polyline?.length}`} />
        {booked ? (
          <div className="rider-booking-form">
            <section aria-live="polite" data-snap="full" className="rider-ride-sheet bg-card shadow-card">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              {searching ? (
                <div className="text-center">
                  <div className="relative mx-auto my-3 grid h-16 w-16 place-items-center"><span className="search-ring" /><span className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><CarFront /></span></div>
                  <h2 className="font-sans text-lg font-bold">Finding your Pink Wheel driver…</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{dots.length} verified driver{dots.length === 1 ? "" : "s"} within 8 km · {booked.booking_code}</p>
                </div>
              ) : booked.status === "cancelled" ? (
                <h2 className="text-center font-sans text-lg font-bold">Ride cancelled</h2>
              ) : (
                <div className="animate-fade-in">
                  <h2 className="font-sans text-lg font-bold">Your driver is on the way</h2>
                  <div className="mt-1"><StatusPill status={booked.status} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">See her name, vehicle, plate and live location on your trip page.</p>
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-muted p-3 text-xs">
                <div><dt className="text-muted-foreground">Pickup</dt><dd className="line-clamp-2 font-medium">{booked.pickup}</dd></div>
                <div><dt className="text-muted-foreground">Drop-off</dt><dd className="line-clamp-2 font-medium">{booked.destination}</dd></div>
                <div><dt className="text-muted-foreground">{VEHICLES.find((v) => v.id === booked.vehicle)?.label} · cash</dt><dd className="font-semibold">{pkr(booked.fare)}</dd></div>
                <div><dt className="text-muted-foreground">Trip PIN</dt><dd className="font-display text-lg tracking-[0.3em]">{booked.trip_pin}</dd></div>
              </dl>
              <div className="mt-4 grid gap-2">
                <Button variant="hero" size="lg" asChild><Link to="/rider">Track my ride</Link></Button>
                {searching && <Button variant="ghost" className="text-destructive" disabled={cancelling} onClick={cancelBooking}>{cancelling ? "Cancelling…" : "Cancel request"}</Button>}
              </div>
            </section>
          </div>
        ) : (
        <form onSubmit={submit} className="rider-booking-form">
          <section aria-label="Your route" className={cn("rider-addresses bg-card shadow-card", both && "py-2")}>
            <div className={cn("space-y-2", both && "space-y-1")}>
              <PlaceInput value={pickup} onChange={setPickup} placeholder="Current location" allowGps dot="pickup" />
              <PlaceInput value={drop} onChange={(p) => { setDrop(p); if (p) setSnap("half"); }} placeholder="Where are you going?" near={pickup ?? undefined} dot="dropoff" />
            </div>
          </section>
          {(routing || info) && (
            <div className="route-chip animate-fade-in flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-card" role="status">
              {routing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding route…</> : <><Clock className="h-3.5 w-3.5" /> {info!.distanceKm} km • {info!.durationMin} min</>}
            </div>
          )}
          <section aria-label="Choose your ride" data-snap={snap} className="rider-ride-sheet bg-card shadow-card">
            <button type="button" aria-label="Resize ride sheet" onClick={() => setSnap((s) => s === "collapsed" ? "half" : s === "half" ? "full" : "collapsed")} className="mx-auto mb-2 flex w-full flex-col items-center gap-1 py-1">
              <span className="h-1 w-10 rounded-full bg-border" />
            </button>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div><h1 className="font-sans text-lg font-bold">Choose your ride</h1><p className="text-xs text-muted-foreground">{both ? `${dots.length} verified driver${dots.length === 1 ? "" : "s"} nearby` : `Where to, ${(name || "rider").split(" ")[0]}?`}</p></div>
              <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", snap === "full" && "rotate-180")} />
            </div>
            <div role="group" aria-label="Vehicle options" className="ride-cards">
              {VEHICLES.map((v) => {
                const fv = fareFor(v.id);
                const near = dots.filter((d) => (d.vehicle ?? "car") === v.id).length;
                return (
                  <button type="button" key={v.id} aria-pressed={vehicle === v.id} onClick={() => setVehicle(v.id)} className="ride-card">
                    <img src={vehicleImages[v.id]} alt="" width={816} height={816} loading="lazy" className="mx-auto h-14 w-20 object-contain" />
                    <span className="mt-1 flex items-center justify-between text-sm font-bold">{v.label}<span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground"><Users className="h-3 w-3" />{v.id === "car" ? "4" : "1"}</span></span>
                    <span className="block text-[11px] text-muted-foreground">{v.id === "car" ? "Comfortable" : v.id === "scooty" ? "Quick & affordable" : "Fast city ride"}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{near ? `${near} nearby` : "Checking nearby"}</span>
                    <span className="mt-1 block text-sm font-bold">{fv != null ? pkr(fv) : info ? "Fare not set" : "—"}</span>
                  </button>
                );
              })}
              <Link to="/pool" className="ride-card ride-card-pool">
                <span className="mx-auto grid h-14 w-20 place-items-center text-3xl" aria-hidden>👭</span>
                <span className="mt-1 flex items-center justify-between text-sm font-bold">Pink Pool<span className="rounded-full bg-card px-1.5 text-[10px] font-semibold text-primary">Shared</span></span>
                <span className="block text-[11px] text-muted-foreground">Share & save</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">Women going your way</span>
                <span className="mt-1 block text-sm font-bold text-primary">See seats →</span>
              </Link>
            </div>
            <div className="rider-booking-action mt-2">
              <Button type="submit" size="lg" className="w-full rounded-2xl" disabled={busy || !ready}>{busy ? <><Loader2 className="animate-spin" /> Confirming…</> : cta}</Button>
              {!ready && !busy && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-primary">{routing ? "Finding your route…" : `Complete ${missing.length} required ${missing.length === 1 ? "detail" : "details"}`}</summary><ul className="mt-2 list-disc space-y-1 pl-4">{missing.map((m) => <li key={m}>{m}</li>)}</ul></details>}
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified female drivers · cash fare · {ec.data ? `sharing ${ec.data.name} as emergency contact` : "add an emergency contact on My rides"}</p>
            </div>
          </section>
        </form>
        )}
      </main>
    </div>
  );
}
