import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Car, Flag, MapPin, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { pkr } from "@/lib/pink";
import {
  fmtDate, fmtTime, platformFee, ROUTE_STATUS_LABEL, SEAT_STATUS_LABEL, useSettings,
  type PoolRoute, type PoolRouteStatus, type PoolSeat, type PoolSeatStatus,
} from "@/lib/pool";

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
      <BadgeCheck className="h-3 w-3" /> {label}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-rose font-display text-lg font-semibold text-primary-foreground">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function RouteStatusPill({ status }: { status: PoolRouteStatus }) {
  const tone =
    status === "open" ? "bg-success/15 text-success"
    : status === "almost_full" ? "bg-accent text-primary"
    : status === "cancelled" || status === "suspended" ? "bg-destructive/10 text-destructive"
    : "bg-muted text-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{ROUTE_STATUS_LABEL[status]}</span>;
}

export function SeatStatusPill({ status }: { status: PoolSeatStatus }) {
  const tone =
    status === "accepted" ? "bg-success/15 text-success"
    : status === "pending" ? "bg-accent text-primary"
    : status === "completed" ? "bg-muted text-foreground"
    : "bg-destructive/10 text-destructive";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{SEAT_STATUS_LABEL[status]}</span>;
}

export function RouteCard({ r, pickupKm }: { r: PoolRoute; pickupKm?: number | undefined }) {
  const full = r.available_seats === 0 || r.status === "full";
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <Avatar name={r.driver_first_name} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {r.driver_first_name}
            <span className="inline-flex items-center gap-0.5 text-sm text-muted-foreground"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{Number(r.driver_rating).toFixed(1)}</span>
            <VerifiedBadge />
          </p>
          <p className="text-xs capitalize text-muted-foreground">{r.vehicle_kind}{r.vehicle_label ? ` · ${r.vehicle_label}` : ""}</p>
        </div>
        <RouteStatusPill status={r.status} />
      </div>
      <p className="mt-4 font-display text-lg font-semibold">{r.start_location} → {r.destination}</p>
      <p className="text-sm text-muted-foreground">{fmtDate(r.departure_date)} · {fmtTime(r.departure_time)}{r.flexible_minutes ? ` (±${r.flexible_minutes} min)` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1"><Users className="h-4 w-4 text-primary" />{full ? "FULL" : `${r.available_seats} seat${r.available_seats === 1 ? "" : "s"} available`}</span>
        {pickupKm !== undefined && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" />~{pickupKm} km to pickup</span>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="font-display text-xl font-semibold">{pkr(r.price_per_seat)} <span className="text-sm font-normal text-muted-foreground">/ seat</span></p>
        <Button variant={full ? "outline" : "hero"} asChild><Link to="/pool/$id" params={{ id: r.id }}>View Route</Link></Button>
      </div>
    </div>
  );
}

export function ReportButton({ about }: { about: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={async () => {
      const reason = window.prompt(`Report ${about}: what happened?`);
      if (!reason?.trim()) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase.from("complaints").insert({ user_id: u.user.id, kind: "complaint", message: `[Pink Pool report] ${about}: ${reason.trim().slice(0, 900)}` });
      if (error) return toast.error(error.message);
      toast.success("Report sent to our safety team.");
    }}><Flag className="h-4 w-4" /> Report</Button>
  );
}

/* ------------------------- Driver: My Offered Routes ------------------------- */

export function DriverPoolSection({ uid, approved }: { uid: string; approved: boolean }) {
  const settings = useSettings();
  const routes = useQuery({
    queryKey: ["my-pool-routes", uid], refetchInterval: 8000,
    queryFn: async () => (await supabase.from("pool_routes").select("*").eq("driver_id", uid).order("departure_date", { ascending: false })).data ?? [],
  });
  const ids = (routes.data ?? []).map((r) => r.id);
  const seats = useQuery({
    queryKey: ["my-pool-seats", ids.join(",")], enabled: ids.length > 0, refetchInterval: 8000,
    queryFn: async () => (await supabase.from("pool_seat_requests").select("*").in("pool_route_id", ids).order("created_at")).data ?? [],
  });
  const refresh = () => { routes.refetch(); seats.refetch(); };
  const all = routes.data ?? [];
  const allSeats = seats.data ?? [];
  const active = all.filter((r) => ["open", "almost_full", "full", "started", "suspended"].includes(r.status));
  const done = all.filter((r) => r.status === "completed");
  const earned = allSeats.filter((s) => s.request_status === "completed").reduce((t, s) => t + s.fare - platformFee(s.fare, s.seats_requested, settings.data), 0);

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-card md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pink Pool</p>
          <h2 className="font-display text-2xl font-semibold">My Offered Routes</h2>
        </div>
        <Button variant="hero" disabled={!approved} asChild={approved}>{approved ? <Link to="/offer">Offer My Route</Link> : <span>Offer My Route</span>}</Button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat l="Upcoming" v={active.length} />
        <Stat l="Completed trips" v={done.length} />
        <Stat l="Pool earnings" v={pkr(earned)} />
      </div>
      {active.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No active routes. Going somewhere? Offer your empty seats.</p> : (
        <div className="mt-4 space-y-4">
          {active.map((r) => <DriverRouteItem key={r.id} r={r} seats={allSeats.filter((s) => s.pool_route_id === r.id)} onChange={refresh} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string | number }) {
  return <div className="rounded-2xl bg-muted p-3"><p className="font-display text-xl font-semibold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>;
}

function DriverRouteItem({ r, seats, onChange }: { r: PoolRoute; seats: PoolSeat[]; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ departure_time: r.departure_time.slice(0, 5), price_per_seat: r.price_per_seat, total_seats: r.total_seats });
  const [pins, setPins] = useState<Record<string, string>>({});
  const [boarded, setBoarded] = useState<Record<string, boolean>>({});
  const pending = seats.filter((s) => s.request_status === "pending");
  const accepted = seats.filter((s) => s.request_status === "accepted");
  const canEdit = accepted.length === 0 && ["open", "almost_full", "full"].includes(r.status);

  async function updRoute(patch: Partial<PoolRoute>) {
    const { error } = await supabase.from("pool_routes").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);
    onChange();
  }
  async function updSeat(id: string, request_status: PoolSeatStatus) {
    const { error } = await supabase.from("pool_seat_requests").update({ request_status }).eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.start_location} → {r.destination}</p>
        <RouteStatusPill status={r.status} />
      </div>
      <p className="text-sm text-muted-foreground">{fmtDate(r.departure_date)} · {fmtTime(r.departure_time)} · {r.available_seats}/{r.total_seats} seats left · {pkr(r.price_per_seat)}/seat</p>
      {r.status === "suspended" && <p className="mt-2 text-sm text-destructive">This route was paused by Pink Wheel admin. Contact support.</p>}

      {edit && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
          <Input type="number" min={1} value={form.price_per_seat} onChange={(e) => setForm({ ...form, price_per_seat: Number(e.target.value) })} />
          <Input type="number" min={1} max={6} value={form.total_seats} onChange={(e) => setForm({ ...form, total_seats: Number(e.target.value) })} />
          <Button size="sm" className="col-span-3" onClick={async () => { await updRoute(form); setEdit(false); }}>Save changes</Button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Seat requests</p>
          {pending.map((s) => (
            <div key={s.id} className="rounded-xl bg-accent/60 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{s.rider_first_name} <VerifiedBadge label="Verified rider" /> <span className="text-xs font-normal text-muted-foreground">★ New</span></p>
              <p>Pickup: {s.pickup_location} · Drop-off: {s.dropoff_location}</p>
              <p className="text-muted-foreground">Deviation ~{Number(s.deviation_km)} km{Number(s.deviation_km) > r.max_route_deviation ? " (beyond your limit)" : ""} · {s.seats_requested} seat(s) · {pkr(s.fare)}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={s.seats_requested > r.available_seats} onClick={() => updSeat(s.id, "accepted")}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => updSeat(s.id, "declined")}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Accepted passengers</p>
          {accepted.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3 text-sm">
              <div><b>{s.rider_first_name}</b> · {s.pickup_location} → {s.dropoff_location} · {pkr(s.fare)}</div>
              {boarded[s.id] ? <span className="font-semibold text-success">PIN verified</span> : (
                <div className="flex gap-1">
                  <Input className="h-8 w-24" inputMode="numeric" maxLength={4} placeholder="Trip PIN" value={pins[s.id] ?? ""} onChange={(e) => setPins({ ...pins, [s.id]: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (pins[s.id] !== s.trip_pin) return toast.error("Incorrect Trip PIN");
                    setBoarded({ ...boarded, [s.id]: true }); toast.success(`${s.rider_first_name} verified`);
                  }}>Verify</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && <Button size="sm" variant="outline" onClick={() => setEdit(!edit)}>{edit ? "Close edit" : "Edit route"}</Button>}
        {["open", "almost_full", "full"].includes(r.status) && (
          <Button size="sm" disabled={accepted.length === 0} onClick={() => updRoute({ status: "started" })}><Car className="h-4 w-4" /> Start trip</Button>
        )}
        {r.status === "started" && <Button size="sm" variant="hero" onClick={() => updRoute({ status: "completed" })}>Complete trip</Button>}
        {r.status !== "started" && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
            if (window.confirm(accepted.length ? "Confirmed passengers will be notified that this route is cancelled. Continue?" : "Cancel this route?")) updRoute({ status: "cancelled" });
          }}>Cancel route</Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Rider: My Pink Pool Trips ------------------------- */

export function RiderPoolSection({ uid }: { uid: string }) {
  const q = useQuery({
    queryKey: ["my-pool-trips", uid], refetchInterval: 8000,
    queryFn: async () => (await supabase.from("pool_seat_requests").select("*, pool_routes(*)").eq("rider_id", uid).order("created_at", { ascending: false })).data ?? [],
  });
  const list = q.data ?? [];
  const groups: { t: string; items: typeof list }[] = [
    { t: "Pending seat requests", items: list.filter((s) => s.request_status === "pending") },
    { t: "Confirmed & upcoming", items: list.filter((s) => s.request_status === "accepted") },
    { t: "Completed", items: list.filter((s) => s.request_status === "completed") },
    { t: "Cancelled / declined", items: list.filter((s) => s.request_status === "cancelled" || s.request_status === "declined") },
  ];
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-card md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pink Pool</p>
          <h2 className="font-display text-2xl font-semibold">My Pink Pool Trips</h2>
        </div>
        <Button variant="hero" asChild><Link to="/pool">Find a Pink Pool</Link></Button>
      </div>
      {list.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No pool trips yet. Share a ride with a verified woman going your way and save.</p> : (
        <div className="mt-4 space-y-4">
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.t}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.t}</p>
              <ul className="space-y-2">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <Link to="/pool/$id" params={{ id: s.pool_route_id }} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3 text-sm hover:bg-accent">
                      <span><b>{s.pickup_location} → {s.dropoff_location}</b><br /><span className="text-muted-foreground">{s.pool_routes ? `${s.pool_routes.driver_first_name} · ${fmtDate(s.pool_routes.departure_date)} ${fmtTime(s.pool_routes.departure_time)}` : ""} · {pkr(s.fare)}</span></span>
                      <SeatStatusPill status={s.request_status} />
                    </Link>
                    {s.request_status === "completed" && <RateTrip kind="pool" id={s.id} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Admin: Pink Pool Management ------------------------- */

export function AdminPoolSection() {
  const settings = useSettings();
  const [fee, setFee] = useState<{ type: string; value: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const routes = useQuery({
    queryKey: ["admin-pool-routes"], refetchInterval: 10000,
    queryFn: async () => (await supabase.from("pool_routes").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const seats = useQuery({
    queryKey: ["admin-pool-seats"], refetchInterval: 10000,
    queryFn: async () => (await supabase.from("pool_seat_requests").select("*")).data ?? [],
  });
  const s = settings.data;
  const f = fee ?? (s ? { type: s.pool_fee_type, value: Number(s.pool_fee_value) } : { type: "percent", value: 10 });

  async function setStatus(id: string, status: PoolRouteStatus) {
    const { error } = await supabase.from("pool_routes").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    routes.refetch(); seats.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <p className="font-semibold">Platform fee for Pink Pool</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={f.type} onChange={(e) => setFee({ ...f, type: e.target.value })}>
            <option value="percent">Percentage commission (%)</option>
            <option value="fixed">Fixed fee per seat (Rs)</option>
          </select>
          <Input type="number" min={0} className="w-28" value={f.value} onChange={(e) => setFee({ ...f, value: Number(e.target.value) })} />
          <Button onClick={async () => {
            const { error } = await supabase.from("app_settings").update({ pool_fee_type: f.type, pool_fee_value: f.value, updated_at: new Date().toISOString() }).eq("id", 1);
            if (error) return toast.error(error.message);
            toast.success("Fee updated"); settings.refetch(); setFee(null);
          }}>Save</Button>
        </div>
      </div>

      {(routes.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No Pink Pool routes posted yet.</p>}
      {(routes.data ?? []).map((r) => {
        const rs = (seats.data ?? []).filter((x) => x.pool_route_id === r.id);
        const paid = rs.filter((x) => x.request_status === "accepted" || x.request_status === "completed");
        const gross = paid.reduce((t, x) => t + x.fare, 0);
        const feeAmt = paid.reduce((t, x) => t + platformFee(x.fare, x.seats_requested, s), 0);
        return (
          <div key={r.id} className="rounded-2xl border bg-card p-4 text-sm shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.start_location} → {r.destination}</p>
              <RouteStatusPill status={r.status} />
            </div>
            <p className="text-muted-foreground">Driver {r.driver_first_name} · {fmtDate(r.departure_date)} {fmtTime(r.departure_time)} · {r.available_seats}/{r.total_seats} seats · {pkr(r.price_per_seat)}/seat</p>
            <p className="text-muted-foreground">Requests {rs.length} · Accepted {paid.length} · Driver earnings {pkr(gross - feeAmt)} · Platform fee {pkr(feeAmt)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "View"} passengers</Button>
              {r.status === "suspended" && <Button size="sm" onClick={() => setStatus(r.id, "open")}>Approve route</Button>}
              {["open", "almost_full", "full"].includes(r.status) && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "suspended")}>Suspend</Button>}
              {!["completed", "cancelled"].includes(r.status) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(r.id, "cancelled")}>Cancel</Button>}
            </div>
            {open === r.id && (
              <ul className="mt-2 space-y-1">
                {rs.length === 0 && <li className="text-muted-foreground">No passenger requests.</li>}
                {rs.map((x) => (
                  <li key={x.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-muted px-3 py-2">
                    <span>{x.rider_first_name} · {x.pickup_location} → {x.dropoff_location} · {x.seats_requested} seat(s) · {pkr(x.fare)} · EC {x.emergency_contact}</span>
                    <SeatStatusPill status={x.request_status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------- Rate a completed trip ------------------------- */

export function RateTrip({ kind, id }: { kind: "ride" | "pool"; id: string }) {
  const table = kind === "ride" ? "ratings" : "pool_ratings";
  const col = kind === "ride" ? "ride_id" : "pool_seat_id";
  const existing = useQuery({
    queryKey: ["rating", kind, id],
    queryFn: async () => (await supabase.from(table).select("stars").eq(col, id).maybeSingle()).data,
  });
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  if (existing.data) return <span className="text-xs text-muted-foreground">You rated {existing.data.stars}★</span>;
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Star className="h-4 w-4" /> Rate</Button>;
  return (
    <div className="mt-2 w-full space-y-2 rounded-xl bg-accent/60 p-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setStars(n)}>
            <Star className={`h-6 w-6 ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <Input maxLength={500} placeholder="Leave a short review (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button size="sm" disabled={!stars} onClick={async () => {
        const { data: u } = await supabase.auth.getUser();
        const row = { stars, comment: comment.trim() || null, rater_id: u.user!.id };
        const { error } = kind === "ride"
          ? await supabase.from("ratings").insert({ ...row, ride_id: id })
          : await supabase.from("pool_ratings").insert({ ...row, pool_seat_id: id });
        if (error) return toast.error(error.message);
        toast.success("Thanks for your review!");
        existing.refetch();
      }}>Submit</Button>
    </div>
  );
}
