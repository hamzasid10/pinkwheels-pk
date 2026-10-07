import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/Brand";
import { RouteCard } from "@/components/Pool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/pink";
import { deviationKm, minutesBetween } from "@/lib/pool";

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
  const [q, setQ] = useState({ from: "", to: "", date: "", time: "" });
  const routes = useQuery({
    queryKey: ["pool-open", me.data?.user.id], refetchInterval: 15000,
    queryFn: async () => (await supabase.from("pool_routes").select("*").in("status", ["open", "almost_full", "full"]).gte("departure_date", today).order("departure_date").order("departure_time")).data ?? [],
  });
  const list = (routes.data ?? [])
    .filter((r) => r.driver_id !== me.data?.user.id)
    .filter((r) => near(q.from, r.start_location) || near(q.from, r.destination))
    .filter((r) => near(q.to, r.destination))
    .filter((r) => !q.date || r.departure_date === q.date)
    .filter((r) => !q.time || minutesBetween(q.time, r.departure_time) <= Math.max(r.flexible_minutes, 15));

  return (
    <AppShell title="Pink Pool">
      <div className="rounded-3xl bg-gradient-blush p-6 shadow-soft">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Going Your Way? Share the Ride.</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Find a verified woman already travelling in your direction. Save money, share the journey, and travel safely.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Input placeholder="From (area)" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} className="bg-card" />
          <Input placeholder="To (area)" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} className="bg-card" />
          <Input type="date" min={today} value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} className="bg-card" />
          <Input type="time" value={q.time} onChange={(e) => setQ({ ...q, time: e.target.value })} className="bg-card" />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Every driver is a verified woman. Trip PIN, SOS and live sharing on every pool ride.</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {routes.isLoading && <p className="text-muted-foreground">Loading routes…</p>}
        {!routes.isLoading && list.length === 0 && (
          <div className="rounded-3xl border bg-card p-6 text-center md:col-span-2">
            <p className="font-semibold">No pool routes match right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a wider search, or book a private ride instead.</p>
            <Button className="mt-3" variant="hero" asChild><Link to="/book">Book a Ride</Link></Button>
          </div>
        )}
        {list.map((r) => <RouteCard key={r.id} r={r} pickupKm={q.from ? deviationKm(r.start_location, r.destination, q.from, q.to || r.destination) : undefined} />)}
      </div>
    </AppShell>
  );
}
