import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, KeyRound, Radio, ShieldCheck, Star, Users } from "lucide-react";
import { AppShell, MapPlaceholder, Panel, SafetyActions } from "@/components/Brand";
import { Avatar, ReportButton, RouteStatusPill, SeatStatusPill, VerifiedBadge } from "@/components/Pool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { estimateFare, pkr, useMe } from "@/lib/pink";
import { deviationKm, fmtDate, fmtTime } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/pool/$id")({
  head: () => ({ meta: [{ title: "Pink Pool Route — Pink Wheel" }, { name: "description", content: "View a shared route and request a seat." }] }),
  component: RouteView,
});

const schema = z.object({
  pickup_location: z.string().trim().min(2, "Enter your pickup").max(120),
  dropoff_location: z.string().trim().min(2, "Enter your drop-off").max(120),
  seats_requested: z.number().int().min(1).max(6),
  emergency_contact: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, "Enter a valid emergency phone number"),
});

function RouteView() {
  const { id } = Route.useParams();
  const me = useMe();
  const uid = me.data?.user.id;
  const route = useQuery({
    queryKey: ["pool-route", id], refetchInterval: 8000,
    queryFn: async () => (await supabase.from("pool_routes").select("*").eq("id", id).maybeSingle()).data,
  });
  const mine = useQuery({
    queryKey: ["pool-my-seat", id, uid], enabled: !!uid, refetchInterval: 8000,
    queryFn: async () => (await supabase.from("pool_seat_requests").select("*").eq("pool_route_id", id).eq("rider_id", uid!).order("created_at", { ascending: false })).data ?? [],
  });
  const [f, setF] = useState({ pickup_location: "", dropoff_location: "", seats_requested: 1, emergency_contact: "" });
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (route.isLoading) return <AppShell title="Pink Pool"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const r = route.data;
  if (!r) return <AppShell title="Pink Pool"><Panel>This route isn't available. <Link to="/pool" className="text-primary">Browse routes</Link></Panel></AppShell>;

  const active = (mine.data ?? []).find((s) => s.request_status === "pending" || s.request_status === "accepted");
  const latest = active ?? (mine.data ?? [])[0];
  const full = r.available_seats === 0;
  const bookable = ["open", "almost_full"].includes(r.status) && !full && r.driver_id !== uid;
  const privateFare = estimateFare(r.vehicle_kind, f.pickup_location || r.start_location, f.dropoff_location || r.destination);
  const poolFare = r.price_per_seat * f.seats_requested;
  const dev = deviationKm(r.start_location, r.destination, f.pickup_location, f.dropoff_location);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (me.data?.profile?.suspended) return toast.error("Your account is suspended.");
    const p = schema.safeParse(f);
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (p.data.seats_requested > r!.available_seats) return toast.error("Not enough seats available");
    setBusy(true);
    const first = (me.data?.profile?.full_name || me.data?.user.email || "Rider").split(/[\s@]/)[0];
    const { error } = await supabase.from("pool_seat_requests").insert({ ...p.data, pool_route_id: r!.id, rider_id: uid!, rider_first_name: first, deviation_km: dev });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Seat requested — waiting for driver approval");
    setAsking(false);
    mine.refetch();
  }

  async function cancelSeat(sid: string) {
    if (!window.confirm("Cancel your seat?")) return;
    const { error } = await supabase.from("pool_seat_requests").update({ request_status: "cancelled" }).eq("id", sid);
    if (error) return toast.error(error.message);
    mine.refetch(); route.refetch();
  }

  return (
    <AppShell title="Pink Pool route">
      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-5 md:col-span-3">
          <Panel>
            <div className="flex items-center gap-3">
              <Avatar name={r.driver_first_name} />
              <div className="flex-1">
                <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">{r.driver_first_name} <VerifiedBadge label="Verified female driver" /></p>
                <p className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Star className="h-3.5 w-3.5 fill-primary text-primary" /> {Number(r.driver_rating).toFixed(1)} rating · <span className="capitalize">{r.vehicle_kind}</span>{r.vehicle_label ? ` · ${r.vehicle_label}` : ""}</p>
              </div>
              <RouteStatusPill status={r.status} />
            </div>
            <div className="mt-4"><MapPlaceholder from={r.start_location} to={r.destination} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info l="Starting point" v={r.start_location} />
              <Info l="Destination" v={r.destination} />
              <Info l="Departure" v={`${fmtDate(r.departure_date)} · ${fmtTime(r.departure_time)}${r.flexible_minutes ? ` (±${r.flexible_minutes}m)` : ""}`} />
              <Info l="Seats left" v={full ? "FULL" : `${r.available_seats} of ${r.total_seats}`} />
              <Info l="Price per seat" v={pkr(r.price_per_seat)} />
              <Info l="Pickup flexibility" v={`Up to ${r.max_route_deviation} km off route`} />
            </div>
            {r.notes && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">“{r.notes}”</p>}
            <div className="mt-2 flex justify-end"><ReportButton about={`driver ${r.driver_first_name} (route ${r.start_location} → ${r.destination})`} /></div>
          </Panel>

          <Panel title="Safety on every Pink Pool">
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {[[BadgeCheck, "Verified female driver"], [Users, "Verified female riders"], [KeyRound, "Trip PIN to board"], [Radio, "SOS & live sharing"]].map(([I, t]) => {
                const Icon = I as typeof BadgeCheck;
                return <li key={t as string} className="flex items-center gap-2 rounded-xl bg-accent/60 p-2"><Icon className="h-4 w-4 text-primary" />{t as string}</li>;
              })}
            </ul>
          </Panel>
        </div>

        <div className="space-y-5 md:col-span-2">
          {active || latest ? (
            <Panel>
              <div className="flex items-center justify-between"><p className="font-semibold">Your seat</p><SeatStatusPill status={(active ?? latest)!.request_status} /></div>
              {(() => {
                const s = (active ?? latest)!;
                return (
                  <div className="mt-3 space-y-2 text-sm">
                    <Info l="Driver" v={`${r.driver_first_name} · ${r.vehicle_label || r.vehicle_kind}`} />
                    <Info l="Pickup point" v={s.pickup_location} />
                    <Info l="Departure" v={`${fmtDate(r.departure_date)} · ${fmtTime(r.departure_time)}`} />
                    <Info l="Fare" v={pkr(s.fare)} />
                    {s.request_status === "accepted" && (
                      <>
                        <div className="rounded-2xl bg-gradient-rose p-4 text-center text-primary-foreground">
                          <p className="text-xs uppercase tracking-wider opacity-90">Trip PIN — share only in the car</p>
                          <p className="font-display text-4xl font-semibold tracking-[0.3em]">{s.trip_pin}</p>
                        </div>
                        <SafetyActions shareText={`I'm on a Pink Pool ride with ${r.driver_first_name} (${r.vehicle_label || r.vehicle_kind}): ${s.pickup_location} → ${s.dropoff_location}, ${fmtDate(r.departure_date)} ${fmtTime(r.departure_time)}`} />
                      </>
                    )}
                    {(s.request_status === "pending" || s.request_status === "accepted") && r.status !== "started" && (
                      <Button variant="outline" className="w-full" onClick={() => cancelSeat(s.id)}>Cancel Seat</Button>
                    )}
                    {!active && bookable && <Button variant="hero" className="w-full" onClick={() => setAsking(true)}>Request another seat</Button>}
                  </div>
                );
              })()}
            </Panel>
          ) : null}

          {!active && (asking || !latest) && (
            <Panel title="Request a seat">
              {!bookable ? (
                <p className="text-sm text-muted-foreground">{full ? "This route is FULL." : r.driver_id === uid ? "This is your own route." : "This route isn't taking requests."}</p>
              ) : (
                <form onSubmit={request} className="space-y-3">
                  <div className="space-y-1.5"><Label>Your pickup</Label><Input maxLength={120} value={f.pickup_location} onChange={(e) => setF({ ...f, pickup_location: e.target.value })} placeholder="Near the driver's route" /></div>
                  <div className="space-y-1.5"><Label>Your drop-off</Label><Input maxLength={120} value={f.dropoff_location} onChange={(e) => setF({ ...f, dropoff_location: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} max={r.available_seats} value={f.seats_requested} onChange={(e) => setF({ ...f, seats_requested: Number(e.target.value) })} /></div>
                    <div className="space-y-1.5"><Label>Emergency contact</Label><Input inputMode="tel" maxLength={20} value={f.emergency_contact} onChange={(e) => setF({ ...f, emergency_contact: e.target.value })} placeholder="03xx…" /></div>
                  </div>
                  {f.pickup_location && f.dropoff_location && dev > r.max_route_deviation && (
                    <p className="rounded-xl bg-accent p-2 text-xs">Your stops look ~{dev} km off this route — the driver may decline.</p>
                  )}
                  <div className="rounded-2xl border border-primary/30 bg-accent/50 p-3 text-sm">
                    <p className="font-semibold text-primary">Save with Pink Pool</p>
                    <div className="mt-1 flex justify-between"><span>Normal Pink Wheel ride</span><span className="line-through">{pkr(privateFare)}</span></div>
                    <div className="flex justify-between font-semibold"><span>Pink Pool</span><span>{pkr(poolFare)}</span></div>
                    {privateFare > poolFare && <p className="mt-1 text-success">You save {pkr(privateFare - poolFare)}</p>}
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Sending…" : "Confirm request"}</Button>
                </form>
              )}
            </Panel>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Driver CNIC, licence and documents are verified by Pink Wheel and never shared.</p>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <div className="rounded-xl bg-muted px-3 py-2"><p className="text-xs text-muted-foreground">{l}</p><p className="font-semibold">{v}</p></div>;
}
