import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Car, FileCheck, Headphones, Inbox, Star, Wallet, CheckCircle2 } from "lucide-react";
import { AppShell, Panel, SafetyActions, StatusPill, StatusTrack } from "@/components/Brand";
import { RideMap, useShareLocation } from "@/components/maps/RideMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { DriverPoolSection } from "@/components/Pool";
import { pkr, useMe, type RideStatus } from "@/lib/pink";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({ meta: [{ title: "Driver Dashboard — Pink Wheel" }, { name: "description", content: "Manage rides and earnings." }] }),
  component: DriverDashboard,
});

function DriverDashboard() {
  const me = useMe();
  const uid = me.data?.user.id;
  const [pin, setPin] = useState("");

  const driver = useQuery({
    queryKey: ["driver", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("drivers").select("*").eq("user_id", uid!).maybeSingle()).data,
  });
  const docs = useQuery({
    queryKey: ["docs", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("driver_documents").select("*").eq("driver_id", uid!)).data ?? [],
  });
  const rides = useQuery({
    queryKey: ["driver-rides", uid], enabled: !!uid, refetchInterval: 8000,
    queryFn: async () => (await supabase.from("ride_requests").select("*").eq("driver_id", uid!).order("created_at", { ascending: false })).data ?? [],
  });
  const locErr = useShareLocation(uid, !!driver.data?.online && driver.data?.status === "approved" && !!me.data?.profile?.location_sharing);

  if (driver.isLoading || me.isLoading) return <AppShell title="Driver dashboard"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!driver.data) {
    return <AppShell title="Driver dashboard"><Panel><p>You haven't applied yet.</p><Button className="mt-3" variant="hero" asChild><Link to="/driver-register">Start application</Link></Button></Panel></AppShell>;
  }
  const d = driver.data;
  const sharing = me.data?.profile?.location_sharing;
  const all = rides.data ?? [];
  const requests = all.filter((r) => r.status === "driver_assigned");
  const current = all.find((r) => r.status === "driver_arriving" || r.status === "ride_started");
  const completed = all.filter((r) => r.status === "completed");
  const today = new Date().toISOString().slice(0, 10);
  const todayEarn = completed.filter((r) => r.updated_at.slice(0, 10) === today).reduce((s, r) => s + r.fare, 0);
  const totalEarn = completed.reduce((s, r) => s + r.fare, 0);

  async function setStatus(id: string, status: RideStatus) {
    const { error } = await supabase.from("ride_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    rides.refetch();
  }

  return (
    <AppShell title={`Hello, ${d.full_name.split(" ")[0]}`}>
      {d.status !== "approved" && (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-accent p-4 text-sm">
          Application status: <b className="capitalize">{d.status}</b>.{" "}
          {d.status === "pending" && "Your application has been received and is under verification."}
          {d.status === "rejected" && "Unfortunately your application was not approved. Contact support for details."}
          {d.status === "suspended" && "Your account is suspended. Contact support."}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Share my live location</p>
              <p className="text-sm text-muted-foreground">Only while you're online. Riders see you only on their own assigned ride; others see an anonymous dot.</p>
            </div>
            <Switch checked={!!sharing} onCheckedChange={async (v) => {
              if (v && !window.confirm("Allow Pink Wheel to use your GPS location while you're online?")) return;
              await supabase.from("profiles").update({ location_sharing: v }).eq("id", uid!);
              if (!v && d.online) await supabase.from("drivers").update({ online: false }).eq("user_id", uid!);
              me.refetch(); driver.refetch();
            }} />
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="font-semibold">{d.online ? "You're online" : "You're offline"}</p>
              <p className="text-sm text-muted-foreground">{d.online ? "Ready to receive ride requests" : sharing ? "Go online to receive rides" : "Turn on location sharing to go online"}</p>
              {locErr && d.online && <p className="text-xs text-destructive">{locErr}</p>}
            </div>
            <Switch checked={d.online} disabled={d.status !== "approved" || (!sharing && !d.online)} onCheckedChange={async (v) => {
              await supabase.from("drivers").update({ online: v }).eq("user_id", uid!);
              driver.refetch();
            }} />
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
          {[
            { icon: Wallet, l: "Today's earnings", v: pkr(todayEarn) },
            { icon: Wallet, l: "Total earnings", v: pkr(totalEarn) },
            { icon: CheckCircle2, l: "Completed rides", v: completed.length },
            { icon: Star, l: "Driver rating", v: `${Number(d.rating).toFixed(1)} ★` },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border bg-card p-4 shadow-soft">
              <s.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-display text-2xl font-semibold">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>

        <Panel title="New ride requests" icon={<Inbox className="h-4 w-4" />}>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">No new requests. Rides assigned to you will appear here.</p> : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-xl bg-muted p-3 text-sm">
                  <p className="font-semibold">{r.pickup} → {r.destination}</p>
                  <p className="text-muted-foreground">{r.ride_date} · {r.ride_time.slice(0, 5)} · <span className="capitalize">{r.vehicle}</span> · {pkr(r.fare)}</p>
                  <p className="text-muted-foreground">Rider: {r.rider_name}</p>
                  <Button size="sm" className="mt-2" disabled={!!current} onClick={() => setStatus(r.id, "driver_arriving")}>Accept ride</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Current ride" icon={<Car className="h-4 w-4" />}>
          {!current ? <p className="text-sm text-muted-foreground">No active ride.</p> : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><b>{current.booking_code}</b><StatusPill status={current.status as RideStatus} /></div>
              <StatusTrack status={current.status as RideStatus} />
              <RideMap ride={current} track={false} />
              <p>Rider: <b>{current.rider_name}</b> · <a className="text-primary" href={`tel:${current.rider_phone}`}>{current.rider_phone}</a></p>
              {current.status === "driver_arriving" ? (
                <div className="flex gap-2">
                  <Input inputMode="numeric" maxLength={4} placeholder="Rider's Trip PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
                  <Button onClick={() => { if (pin !== current.trip_pin) return toast.error("Incorrect Trip PIN"); setPin(""); setStatus(current.id, "ride_started"); }}>Start</Button>
                </div>
              ) : (
                <Button variant="hero" className="w-full" onClick={() => setStatus(current.id, "completed")}>Complete ride</Button>
              )}
              <SafetyActions rideId={current.id} shareText={`I'm driving Pink Wheel ride ${current.booking_code}: ${current.pickup} → ${current.destination}`} />
            </div>
          )}
        </Panel>

        <DriverPoolSection uid={uid!} approved={d.status === "approved"} />

        <Panel title="Documents status" icon={<FileCheck className="h-4 w-4" />}>
          <ul className="space-y-2 text-sm">
            {(docs.data ?? []).map((x) => (
              <li key={x.id} className="flex justify-between rounded-xl bg-muted px-3 py-2">
                <span className="capitalize">{x.doc_type}</span>
                <span className={x.verified ? "font-semibold text-success" : "text-muted-foreground"}>{x.verified ? "Verified" : "Under review"}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Help & support" icon={<Headphones className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">Our 24/7 driver support team is here for you.</p>
          <Button variant="outline" className="mt-3" asChild><a href="mailto:Hamza.icaruss@gmail.com">Contact support</a></Button>
        </Panel>
      </div>
    </AppShell>
  );
}
