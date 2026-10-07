import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { AppShell, MapPlaceholder, Panel } from "@/components/Brand";
import { RouteStatusPill } from "@/components/Pool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { estimateFare, pkr, useMe } from "@/lib/pink";
import { FLEX_OPTIONS, fmtDate, fmtTime, type PoolRoute } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/offer")({
  head: () => ({ meta: [{ title: "Offer My Route — Pink Pool" }, { name: "description", content: "Offer empty seats on a journey you're already making." }] }),
  component: OfferPage,
});

const schema = z.object({
  start_location: z.string().trim().min(2, "Enter a starting location").max(120),
  destination: z.string().trim().min(2, "Enter a destination").max(120),
  departure_date: z.string().min(1, "Pick a date"),
  departure_time: z.string().min(1, "Pick a time"),
  total_seats: z.number().int().min(1).max(6),
  price_per_seat: z.number().int().min(50, "Price must be at least Rs 50").max(20000),
  notes: z.string().max(300).optional(),
});

function OfferPage() {
  const me = useMe();
  const uid = me.data?.user.id;
  const driver = useQuery({
    queryKey: ["driver", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("drivers").select("*").eq("user_id", uid!).maybeSingle()).data,
  });
  const vehicles = useQuery({
    queryKey: ["vehicles", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("vehicles").select("*").eq("driver_id", uid!)).data ?? [],
  });
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ start_location: "", destination: "", departure_date: today, departure_time: "", flexible_minutes: 10, vehicle_id: "", total_seats: 2, price_per_seat: 300, max_route_deviation: 2, notes: "" });
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState<PoolRoute | null>(null);

  if (me.isLoading || driver.isLoading) return <AppShell title="Offer My Route"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!driver.data || driver.data.status !== "approved") {
    return (
      <AppShell title="Offer My Route">
        <Panel>
          <p className="font-semibold">Only verified Pink Wheel drivers can offer routes.</p>
          <p className="mt-1 text-sm text-muted-foreground">{driver.data ? "Your driver application is still under verification." : "Apply as a driver first — once verified, you can share your empty seats."}</p>
          <Button className="mt-3" variant="hero" asChild>{driver.data ? <Link to="/driver">Go to dashboard</Link> : <Link to="/driver-register">Become a driver</Link>}</Button>
        </Panel>
      </AppShell>
    );
  }

  const vlist = vehicles.data ?? [];
  const vehicle = vlist.find((v) => v.id === f.vehicle_id) ?? vlist[0];
  const privateFare = vehicle ? estimateFare(vehicle.kind, f.start_location, f.destination) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse({ ...f, notes: f.notes || undefined });
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (!vehicle) return toast.error("Add a vehicle to your profile first");
    if (f.departure_date < today) return toast.error("Date can't be in the past");
    setBusy(true);
    const { data, error } = await supabase.from("pool_routes").insert({
      ...p.data, notes: p.data.notes ?? null, driver_id: uid!, driver_first_name: "", vehicle_id: vehicle.id, vehicle_kind: vehicle.kind,
      vehicle_label: vehicle.make_model, flexible_minutes: f.flexible_minutes, max_route_deviation: f.max_route_deviation,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setPosted(data);
  }

  if (posted) {
    return (
      <AppShell title="Pink Pool">
        <Panel className="mx-auto max-w-lg text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h2 className="mt-3 font-display text-2xl font-semibold">Your Pink Pool route is live.</h2>
          <div className="mt-5 space-y-2 text-left text-sm">
            <MapPlaceholder from={posted.start_location} to={posted.destination} />
            <Row l="Route" v={`${posted.start_location} → ${posted.destination}`} />
            <Row l="Departure" v={`${fmtDate(posted.departure_date)} · ${fmtTime(posted.departure_time)}`} />
            <Row l="Available seats" v={String(posted.available_seats)} />
            <Row l="Price per seat" v={pkr(posted.price_per_seat)} />
            <div className="flex justify-between rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">Route status</span><RouteStatusPill status={posted.status} /></div>
          </div>
          <Button className="mt-5 w-full" variant="hero" asChild><Link to="/driver">Manage my routes</Link></Button>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Offer My Route">
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
        <Panel>
          <p className="text-sm text-muted-foreground">Already travelling somewhere? Offer your empty seats to verified women going the same way.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field l="Starting location"><Input value={f.start_location} maxLength={120} placeholder="e.g. Lake City" onChange={(e) => setF({ ...f, start_location: e.target.value })} /></Field>
            <Field l="Destination"><Input value={f.destination} maxLength={120} placeholder="e.g. DHA Phase 8" onChange={(e) => setF({ ...f, destination: e.target.value })} /></Field>
            <Field l="Date"><Input type="date" min={today} value={f.departure_date} onChange={(e) => setF({ ...f, departure_date: e.target.value })} /></Field>
            <Field l="Departure time"><Input type="time" value={f.departure_time} onChange={(e) => setF({ ...f, departure_time: e.target.value })} /></Field>
          </div>
          <Field l="Flexible departure time" className="mt-4">
            <Chips value={f.flexible_minutes} options={FLEX_OPTIONS} onChange={(v) => setF({ ...f, flexible_minutes: v })} />
          </Field>
        </Panel>
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field l="Vehicle">
              {vlist.length === 0 ? <p className="text-sm text-muted-foreground">No vehicle on file.</p> : (
                <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={vehicle?.id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
                  {vlist.map((v) => <option key={v.id} value={v.id}>{v.make_model} ({v.kind}) · {v.reg_no}</option>)}
                </select>
              )}
            </Field>
            <Field l="Available seats"><Input type="number" min={1} max={6} value={f.total_seats} onChange={(e) => setF({ ...f, total_seats: Number(e.target.value) })} /></Field>
            <Field l="Price per seat (Rs)"><Input type="number" min={50} value={f.price_per_seat} onChange={(e) => setF({ ...f, price_per_seat: Number(e.target.value) })} /></Field>
            <div className="self-end rounded-xl bg-accent p-3 text-xs">
              {privateFare > 0 ? <>A private ride on this route costs about <b>{pkr(privateFare)}</b>. Keep Pink Pool cheaper.</> : "Pink Pool seats should cost less than a private ride."}
            </div>
          </div>
          <Field l="Maximum pickup deviation" className="mt-4">
            <Chips value={f.max_route_deviation} options={[1, 2, 3].map((v) => ({ v, l: `${v} km` }))} onChange={(v) => setF({ ...f, max_route_deviation: v })} />
          </Field>
          <Field l="Notes (optional)" className="mt-4"><Textarea maxLength={300} value={f.notes} placeholder="e.g. Can pick up near Main Boulevard" onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </Panel>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "Posting…" : "Post My Route"}</Button>
      </form>
    </AppShell>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between gap-3 rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">{l}</span><b className="text-right">{v}</b></div>;
}
function Field({ l, children, className }: { l: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{l}</Label>{children}</div>;
}
function Chips({ value, options, onChange }: { value: number; options: { v: number; l: string }[]; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o.v} onClick={() => onChange(o.v)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${value === o.v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>{o.l}</button>
      ))}
    </div>
  );
}
