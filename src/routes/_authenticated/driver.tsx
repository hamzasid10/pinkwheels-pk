import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, FileCheck, Headphones, Inbox } from "lucide-react";
import { AppShell, Panel, SafetyActions, StatusPill, StatusTrack } from "@/components/Brand";
import { RideMap, useShareLocation } from "@/components/maps/RideMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { DriverPoolSection } from "@/components/Pool";
import { DriverProfile } from "@/components/DriverProfile";
import { pkr, useMe, type RideStatus } from "@/lib/pink";
import { ModeCard, useMode } from "@/components/ModeSwitch";
import { IncomingRideOffers } from "@/components/IncomingRideOffers";
import { ACTIVE_DRIVER_STATUSES } from "@/lib/ride-dispatch";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({ meta: [{ title: "Driver Profile — Pink Wheel" }, { name: "description", content: "Your verified driver profile, real trip earnings and ride controls." }, { property: "og:title", content: "Driver Profile — Pink Wheel" }, { property: "og:description", content: "Your verified driver profile, real trip earnings and ride controls." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DriverDashboard,
});

function DriverDashboard() {
  const me = useMe();
  const { mode } = useMode();
  const uid = me.data?.user.id;
  const [pin, setPin] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);

  const driver = useQuery({
    queryKey: ["driver", uid], enabled: !!uid,
    queryFn: async () => { if (!uid) return null; const { data, error } = await supabase.from("drivers").select("*").eq("user_id", uid).maybeSingle(); if (error) throw error; return data; },
  });
  const docs = useQuery({
    queryKey: ["docs", uid], enabled: !!uid,
    queryFn: async () => { if (!uid) return []; const { data, error } = await supabase.from("driver_documents").select("*").eq("driver_id", uid); if (error) throw error; return data ?? []; },
  });
  const rides = useQuery({
    queryKey: ["driver-rides", uid], enabled: !!uid, refetchInterval: 8000,
    queryFn: async () => { if (!uid) return []; const { data, error } = await supabase.from("ride_requests").select("*").eq("driver_id", uid).order("created_at", { ascending: false }); if (error) throw error; return data ?? []; },
  });
  useEffect(() => {
    if (!uid || mode !== "driver") return;
    const ch = supabase.channel(`driver-rides-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests", filter: `driver_id=eq.${uid}` }, () => { void rides.refetch(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid, mode]);
  const locErr = useShareLocation(uid, !!driver.data?.online && mode === "driver" && driver.data?.status === "approved" && !!me.data?.profile?.location_sharing);

  if (driver.isLoading || me.isLoading || rides.isLoading || docs.isLoading) return <AppShell title="Driver profile"><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (driver.isError || rides.isError || docs.isError) return <AppShell title="Driver profile"><p role="alert">Your driver information couldn't load.</p><Button onClick={() => { driver.refetch(); rides.refetch(); docs.refetch(); }}>Try again</Button></AppShell>;
  if (!driver.data || !uid) {
    return <AppShell title="Driver dashboard"><Panel><p>You haven't applied yet.</p><Button className="mt-3" variant="hero" asChild><Link to="/driver-register">Start application</Link></Button></Panel></AppShell>;
  }
  const d = driver.data;
  const sharing = me.data?.profile?.location_sharing;
  const all = rides.data ?? [];
  const requests = all.filter((r) => r.status === "driver_assigned");
  const current = all.find((r) => r.status !== "driver_assigned" && ACTIVE_DRIVER_STATUSES.includes(r.status));
  async function setStatus(id: string, status: RideStatus) {
    const { error } = await supabase.from("ride_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    rides.refetch();
  }

  async function toggleOnline() {
    if (onlineBusy || d.status !== "approved" || me.data?.profile?.suspended) return;
    if (mode !== "driver") return toast.info("Switch to Driver Mode before going online.");
    if (!d.online && !sharing) {
      document.getElementById("driver-safety")?.scrollIntoView({ behavior: "smooth" });
      toast.info("Turn on location sharing before going online.");
      return;
    }
    setOnlineBusy(true);
    try {
      const { error } = await supabase.from("drivers").update({ online: !d.online }).eq("user_id", d.user_id);
      if (error) return toast.error(error.message);
      await driver.refetch();
    } finally { setOnlineBusy(false); }
  }

  return (
    <AppShell title="Driver profile">
      <ModeCard className="mx-auto mb-5 max-w-3xl" />
      <div id="driver-earnings" className="scroll-mt-24"><DriverProfile driver={d} rides={all} docs={docs.data ?? []} sharing={!!sharing} suspended={!!me.data?.profile?.suspended} onOnline={toggleOnline} /></div>
      <div id="driver-safety" className="mx-auto mb-7 max-w-3xl scroll-mt-24">
        <h2 className="mb-3 font-sans text-sm font-bold">Safety & location</h2>
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0"><p className="font-semibold">Share my live location</p><p className="mt-1 text-xs text-muted-foreground">Only while online. Exact location is visible only to your assigned rider and authorized admins.</p></div>
            <Switch aria-label="Share my live location" checked={!!sharing} disabled={d.status !== "approved" || !!me.data?.profile?.suspended} onCheckedChange={async (v) => {
              if (v && !window.confirm("Allow Pink Wheel to use your GPS location while you're online?")) return;
              const { error } = await supabase.from("profiles").update({ location_sharing: v }).eq("id", d.user_id);
              if (error) return toast.error(error.message);
              if (!v && d.online) {
                const result = await supabase.from("drivers").update({ online: false }).eq("user_id", d.user_id);
                if (result.error) toast.error(result.error.message);
              }
              me.refetch(); driver.refetch();
            }} />
          </div>
          {locErr && d.online && <p role="alert" className="mt-2 text-xs text-destructive">{locErr}</p>}
          <div className="mt-4 flex flex-wrap gap-3 border-t pt-4"><Button variant="outline" size="sm" asChild><Link to="/safety">Safety guidelines</Link></Button><Button variant="outline" size="sm" asChild><a href="tel:15">Emergency · 15</a></Button></div>
        </Panel>
      </div>
      {d.status === "approved" && <div id="driver-rides" className="grid scroll-mt-24 gap-5 md:grid-cols-2">
        <Panel title="New ride requests" icon={<Inbox className="h-4 w-4" />}>
          <IncomingRideOffers uid={uid} enabled={mode === "driver" && d.online && d.status === "approved"} />
          {requests.length === 0 ? null : (
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
              {current.status === "accepted" ? <Button onClick={() => setStatus(current.id, "driver_arriving")}>On my way</Button> : current.status === "driver_arriving" ? <Button onClick={() => setStatus(current.id, "arrived")}>I've arrived</Button> : current.status === "arrived" ? (
                <div className="flex gap-2">
                  <Input inputMode="numeric" maxLength={4} placeholder="Rider's Trip PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
                  <Button onClick={async () => {
                    const { error } = await supabase.rpc("start_assigned_ride", { _ride: current.id, _pin: pin });
                    if (error) return toast.error(error.message);
                    setPin(""); void rides.refetch();
                  }}>Start</Button>
                </div>
              ) : (
                <Button variant="hero" className="w-full" onClick={() => setStatus(current.id, "completed")}>Complete ride</Button>
              )}
              <SafetyActions rideId={current.id} shareText={`I'm driving Pink Wheel ride ${current.booking_code}: ${current.pickup} → ${current.destination}`} />
            </div>
          )}
        </Panel>

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
      </div>}
      <div id="driver-pool" className="mt-7 scroll-mt-24"><DriverPoolSection uid={uid} approved={d.status === "approved" && !me.data?.profile?.suspended} /></div>
      <p className="mt-7 text-center text-xs text-muted-foreground">Pink Wheel · Women Moving Women</p>
    </AppShell>
  );
}
