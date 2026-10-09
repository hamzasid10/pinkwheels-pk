import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { matchPoolRoutes } from "@/lib/pool-match.functions";
import { AppShell } from "@/components/Brand";
import { RouteCard } from "@/components/Pool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/pink";
import { deviationKm, minutesBetween } from "@/lib/pool";
import { PlaceInput, type Place } from "@/components/maps/PlaceInput";
import { decodePolyline, distanceToPath, pathIndex } from "@/lib/maps/cities";

export const Route = createFileRoute("/_authenticated/pool/")({
  head: () => ({ meta: [{ title: "Pink Pool — Shared rides by women" }, { name: "description", content: "Find cheaper shared rides offered by verified women drivers going your way." }] }),
  component: PoolList,
});

const near = (a: string, b: string) => {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  return !x || y.includes(x) || x.includes(y);
};

function PoolList() {
  const me = useMe();
  const today = new Date().toISOString().slice(0, 10);
  const [q, setQ] = useState({ date: "", time: "" });
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const routes = useQuery({
    queryKey: ["pool-open", me.data?.user.id], refetchInterval: 15000,
    queryFn: async () => (await supabase.from("pool_routes").select("*").in("status", ["open", "almost_full", "full"]).gte("departure_date", today).order("departure_date").order("departure_time")).data ?? [],
  });
  const match = useServerFn(matchPoolRoutes);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ pickup: string; dropoff: string; matches: { route_id: string; score: number; reason: string }[] } | null>(null);
  async function runAi(e: React.FormEvent) {
    e.preventDefault();
    if (ask.trim().length < 5) return toast.error("Describe your trip a bit more");
    setBusy(true);
    try {
      const res = await match({ data: { query: ask } });
      if (!res.ok) return toast.error(res.error);
      setAi(res);
      routes.refetch();
    } catch { toast.error("Couldn't match routes right now."); }
    finally { setBusy(false); }
  }
  const byId = new Map((routes.data ?? []).map((r) => [r.id, r]));
  const geo = (r: NonNullable<typeof routes.data>[number]) => {
    if (!from || !to || !r.route_polyline) return null;
    const path = decodePolyline(r.route_polyline);
    const dp = distanceToPath(from, path), dd = distanceToPath(to, path);
    const ok = dp <= r.max_route_deviation + 0.5 && dd <= r.max_route_deviation + 0.5 && pathIndex(from, path) <= pathIndex(to, path);
    return { ok, pickupKm: Math.round(dp * 10) / 10 };
  };
  const list = (routes.data ?? [])
    .filter((r) => r.driver_id !== me.data?.user.id)
    .filter((r) => {
      if (from && to) return r.route_polyline ? geo(r)!.ok : near(from.address.split(",")[0], r.start_location) || near(to.address.split(",")[0], r.destination);
      return true;
    })
    .filter((r) => !q.date || r.departure_date === q.date)
    .filter((r) => !q.time || minutesBetween(q.time, r.departure_time) <= Math.max(r.flexible_minutes, 15));

  return (
    <AppShell title="Pink Pool">
      <div className="rounded-3xl bg-gradient-blush p-6 shadow-soft">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Going Your Way? Share the Ride.</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Find a verified woman already travelling in your direction — within the city or between Lahore, Gujranwala, Islamabad and Rawalpindi.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <PlaceInput value={from} onChange={setFrom} placeholder="Your pickup" allowGps dot="pickup" />
          <PlaceInput value={to} onChange={setTo} placeholder="Your drop-off" near={from ?? undefined} dot="dropoff" />
          <Input type="date" min={today} value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} className="h-12 rounded-2xl bg-card" />
          <Input type="time" value={q.time} onChange={(e) => setQ({ ...q, time: e.target.value })} className="h-12 rounded-2xl bg-card" />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Every driver is a verified woman. Trip PIN, SOS and live sharing on every pool ride.</p>
      </div>

      <form onSubmit={runAi} className="mt-5 rounded-3xl border border-primary/30 bg-card p-5 shadow-soft">
        <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Describe your trip</p>
        <p className="text-xs text-muted-foreground">e.g. “I need to get from near Johar Town to DHA Phase 6 around 5:30 this evening”. AI-powered matching finds routes going your way.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={ask} maxLength={400} onChange={(e) => setAsk(e.target.value)} placeholder="Where are you going, and when?" />
          <Button type="submit" variant="hero" disabled={busy}>{busy ? "Finding matches…" : "Find my match"}</Button>
        </div>
      </form>

      {ai && (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm"><b>Best matches</b>{ai.pickup && <span className="text-muted-foreground"> · {ai.pickup} → {ai.dropoff}</span>}</p>
            <Button size="sm" variant="ghost" onClick={() => setAi(null)}>Clear</Button>
          </div>
          {ai.matches.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm">No routes going your way right now. Try the filters below, or book a private ride.</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {ai.matches.map((m) => {
                const r = byId.get(m.route_id);
                if (!r) return null;
                return (
                  <div key={m.route_id} className="space-y-2">
                    <div className="flex items-start gap-2 rounded-2xl bg-accent px-3 py-2 text-xs"><span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">{m.score}% match</span><span>{m.reason}</span></div>
                    <RouteCard r={r} pickupKm={deviationKm(r.start_location, r.destination, ai.pickup, ai.dropoff)} />
                  </div>
                );
              })}
            </div>
          )}
          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">All routes</p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {routes.isLoading && <p className="text-muted-foreground">Loading routes…</p>}
        {!routes.isLoading && list.length === 0 && (
          <div className="rounded-3xl border bg-card p-6 text-center md:col-span-2">
            <p className="font-semibold">No pool routes match right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a wider search, or book a private ride instead.</p>
            <Button className="mt-3" variant="hero" asChild><Link to="/book">Book a Ride</Link></Button>
          </div>
        )}
        {list.map((r) => <RouteCard key={r.id} r={r} pickupKm={geo(r)?.pickupKm} />)}
      </div>
    </AppShell>
  );
}
