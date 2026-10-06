import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { AppShell, MapPlaceholder, Panel, SafetyActions, StatusPill } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { estimateFare, pkr, useMe, VEHICLES, type Vehicle, type RideStatus } from "@/lib/pink";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a Ride — Pink Wheel" },
      { name: "description", content: "Book a car, scooty or bike with a verified female driver." },
    ],
  }),
  component: BookPage,
});

const schema = z.object({
  pickup: z.string().trim().min(3, "Enter pickup").max(200),
  destination: z.string().trim().min(3, "Enter destination").max(200),
  ride_date: z.string().min(1, "Pick a date"),
  ride_time: z.string().min(1, "Pick a time"),
  rider_name: z.string().trim().min(2, "Enter your name").max(100),
  rider_phone: z.string().trim().min(7, "Enter phone").max(20),
  emergency_contact: z.string().trim().min(7, "Enter emergency contact").max(120),
});

type Booked = { id: string; booking_code: string; pickup: string; destination: string; vehicle: Vehicle; fare: number; status: RideStatus; trip_pin: string };

function BookPage() {
  const me = useMe();
  const today = new Date().toISOString().slice(0, 10);
  const [vehicle, setVehicle] = useState<Vehicle>("car");
  const [f, setF] = useState({ pickup: "", destination: "", ride_date: today, ride_time: "", rider_name: "", rider_phone: "", emergency_contact: "" });
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const name = f.rider_name || me.data?.profile?.full_name || "";
  const phone = f.rider_phone || me.data?.profile?.phone || "";
  const fare = estimateFare(vehicle, f.pickup, f.destination);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ ...f, rider_name: name, rider_phone: phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    if (!me.data) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("ride_requests")
      .insert({ ...parsed.data, vehicle, fare, rider_id: me.data.user.id })
      .select("id, booking_code, pickup, destination, vehicle, fare, status, trip_pin")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setBooked(data as Booked);
  }

  if (booked) {
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
          <div className="mt-4"><MapPlaceholder from={booked.pickup} to={booked.destination} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Pickup</dt><dd className="font-medium">{booked.pickup}</dd></div>
            <div><dt className="text-muted-foreground">Destination</dt><dd className="font-medium">{booked.destination}</dd></div>
            <div><dt className="text-muted-foreground">Vehicle</dt><dd className="font-medium capitalize">{booked.vehicle}</dd></div>
            <div><dt className="text-muted-foreground">Estimated fare</dt><dd className="font-medium">{pkr(booked.fare)}</dd></div>
            <div><dt className="text-muted-foreground">Trip PIN</dt><dd className="font-display text-xl tracking-[0.3em]">{booked.trip_pin}</dd></div>
          </dl>
          <div className="mt-4"><StatusPill status={booked.status} /></div>
          <div className="mt-5"><SafetyActions rideId={booked.id} shareText={`I'm booking a Pink Wheel ride ${booked.booking_code}: ${booked.pickup} → ${booked.destination}`} /></div>
          <Button className="mt-5 w-full" variant="hero" asChild><Link to="/rider">Go to my dashboard</Link></Button>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Book a ride">
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Panel title="Where to?">
            <div className="space-y-3">
              <div><Label>Pickup location</Label><Input value={f.pickup} onChange={set("pickup")} placeholder="e.g. Gulberg III, Lahore" /></div>
              <div><Label>Destination</Label><Input value={f.destination} onChange={set("destination")} placeholder="e.g. DHA Phase 5" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ride date</Label><Input type="date" min={today} value={f.ride_date} onChange={set("ride_date")} /></div>
                <div><Label>Ride time</Label><Input type="time" value={f.ride_time} onChange={set("ride_time")} /></div>
              </div>
            </div>
          </Panel>
          <Panel title="Choose vehicle">
            <div className="grid grid-cols-3 gap-2">
              {VEHICLES.map((v) => (
                <button type="button" key={v.id} onClick={() => setVehicle(v.id)}
                  className={cn("rounded-2xl border-2 p-3 text-left transition", vehicle === v.id ? "border-primary bg-accent" : "border-border bg-card")}>
                  <p className="font-semibold">{v.label}</p>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{v.desc}</p>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Your details">
            <div className="space-y-3">
              <div><Label>Rider name</Label><Input value={name} onChange={set("rider_name")} /></div>
              <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={set("rider_phone")} /></div>
              <div><Label>Emergency contact (name & phone)</Label><Input value={f.emergency_contact} onChange={set("emergency_contact")} placeholder="e.g. Ammi — 0300 1234567" /></div>
            </div>
          </Panel>
        </div>
        <div className="md:sticky md:top-20 md:self-start">
          <Panel title="Estimated fare">
            <MapPlaceholder from={f.pickup || "Pickup"} to={f.destination || "Destination"} />
            <p className="mt-4 font-display text-4xl font-semibold">{fare ? pkr(fare) : "—"}</p>
            <p className="text-xs text-muted-foreground">Final fare may vary slightly with route.</p>
            <Button type="submit" variant="hero" size="lg" className="mt-5 w-full" disabled={busy}>{busy ? "Booking…" : "Book Ride"}</Button>
          </Panel>
        </div>
      </form>
    </AppShell>
  );
}
