import { RateTrip, RiderPoolSection } from "@/components/Pool";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Car, Clock, Headphones, History, MapPin, Phone, Plus, Trash2, User } from "lucide-react";
import { AppShell, Panel, SafetyActions, StatusPill, StatusTrack } from "@/components/Brand";
import { RideMap } from "@/components/maps/RideMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pkr, useMe, type RideStatus } from "@/lib/pink";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({ meta: [{ title: "My Rides — Pink Wheel" }, { name: "description", content: "Your Pink Wheel rider dashboard." }] }),
  component: RiderDashboard,
});

function RiderDashboard() {
  const me = useMe();
  const qc = useQueryClient();
  const uid = me.data?.user.id;

  const rides = useQuery({
    queryKey: ["my-rides", uid],
    enabled: !!uid,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase.from("ride_requests").select("*").eq("rider_id", uid!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const locs = useQuery({
    queryKey: ["locs", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("saved_locations").select("*").order("created_at")).data ?? [],
  });
  const contacts = useQuery({
    queryKey: ["ec", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("emergency_contacts").select("*").eq("user_id", uid!).order("created_at")).data ?? [],
  });

  const [loc, setLoc] = useState({ label: "", address: "" });
  const [ec, setEc] = useState({ name: "", phone: "" });
  const [help, setHelp] = useState("");
  const [prof, setProf] = useState<{ full_name: string; phone: string } | null>(null);

  if (me.data?.profile?.suspended) return <AppShell title="Account suspended"><Panel>Your account is suspended. Please contact support.</Panel></AppShell>;

  const all = rides.data ?? [];
  const upcoming = all.find((r) => !["completed", "cancelled"].includes(r.status));
  const history = all.filter((r) => r !== upcoming);
  const firstName = (me.data?.profile?.full_name || "there").split(" ")[0];
  const p = prof ?? { full_name: me.data?.profile?.full_name ?? "", phone: me.data?.profile?.phone ?? "" };

  async function cancel(id: string) {
    const { error } = await supabase.from("ride_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ride cancelled");
    qc.invalidateQueries({ queryKey: ["my-rides"] });
  }

  return (
    <AppShell title={`Hi, ${firstName}`}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-gradient-rose p-6 text-primary-foreground shadow-glow md:col-span-2">
          <p className="text-sm opacity-90">Where are you going today?</p>
          <Button variant="secondary" size="lg" className="mt-3" asChild><Link to="/book"><Plus /> Book New Ride</Link></Button>
        </div>

        <Panel title="Upcoming ride" icon={<Car className="h-4 w-4" />} className="md:col-span-2">
          {!upcoming ? (
            <p className="text-sm text-muted-foreground">No upcoming rides.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-xl">{upcoming.booking_code}</p>
                <StatusPill status={upcoming.status as RideStatus} />
              </div>
              <StatusTrack status={upcoming.status as RideStatus} />
              <RideMap ride={upcoming} />
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div><p className="text-muted-foreground">When</p><p className="font-medium">{upcoming.ride_date} · {upcoming.ride_time.slice(0, 5)}</p></div>
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium capitalize">{upcoming.vehicle}</p></div>
                <div><p className="text-muted-foreground">Fare</p><p className="font-medium">{pkr(upcoming.fare)}</p></div>
                <div><p className="text-muted-foreground">Trip PIN</p><p className="font-display text-xl tracking-[0.3em]">{upcoming.trip_pin}</p></div>
              </div>
              {upcoming.driver_name && (
                <div className="flex items-center gap-3 rounded-xl bg-accent p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-card"><User className="h-5 w-5 text-primary" /></span>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{upcoming.driver_name} · Verified</p>
                    <p className="text-muted-foreground">{upcoming.driver_vehicle}</p>
                  </div>
                  {upcoming.driver_phone && <Button size="icon" variant="outline" asChild><a href={`tel:${upcoming.driver_phone}`}><Phone /></a></Button>}
                </div>
              )}
              <SafetyActions rideId={upcoming.id} shareText={`My Pink Wheel ride ${upcoming.booking_code}: ${upcoming.pickup} → ${upcoming.destination}. Driver: ${upcoming.driver_name ?? "being assigned"}. Status: ${upcoming.status}`} />
              {["requested", "driver_assigned", "driver_arriving"].includes(upcoming.status) && (
                <Button variant="ghost" className="w-full text-destructive" onClick={() => cancel(upcoming.id)}>Cancel ride</Button>
              )}
            </div>
          )}
        </Panel>

        {me.data?.user.id && <RiderPoolSection uid={me.data.user.id} />}

        <Panel title="Ride history" icon={<History className="h-4 w-4" />}>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No past rides yet.</p> : (
            <ul className="divide-y">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{r.pickup} → {r.destination}</p><p className="text-xs text-muted-foreground">{r.ride_date} · {pkr(r.fare)}</p></div>
                  <div className="flex shrink-0 items-center gap-1">{r.status === "completed" && <RateTrip kind="ride" id={r.id} />}<StatusPill status={r.status as RideStatus} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Saved locations" icon={<MapPin className="h-4 w-4" />}>
          <ul className="mb-3 space-y-2">
            {(locs.data ?? []).map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                <span><b>{l.label}</b> · {l.address}</span>
                <button aria-label="Delete" onClick={async () => { await supabase.from("saved_locations").delete().eq("id", l.id); locs.refetch(); }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!loc.label.trim() || !loc.address.trim()) return;
            await supabase.from("saved_locations").insert({ user_id: uid!, label: loc.label.trim().slice(0, 40), address: loc.address.trim().slice(0, 200) });
            setLoc({ label: "", address: "" }); locs.refetch();
          }}>
            <Input className="w-24" placeholder="Home" value={loc.label} onChange={(e) => setLoc({ ...loc, label: e.target.value })} />
            <Input placeholder="Address" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} />
            <Button size="icon" type="submit"><Plus /></Button>
          </form>
        </Panel>

        <Panel title="Emergency contact" icon={<Phone className="h-4 w-4" />}>
          <ul className="mb-3 space-y-2">
            {(contacts.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                <span><b>{c.name}</b> · {c.phone}</span>
                <button aria-label="Delete" onClick={async () => { await supabase.from("emergency_contacts").delete().eq("id", c.id); contacts.refetch(); }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!ec.name.trim() || ec.phone.trim().length < 7) return toast.error("Enter name and phone");
            await supabase.from("emergency_contacts").insert({ user_id: uid!, name: ec.name.trim().slice(0, 80), phone: ec.phone.trim().slice(0, 20) });
            setEc({ name: "", phone: "" }); contacts.refetch();
          }}>
            <Input placeholder="Name" value={ec.name} onChange={(e) => setEc({ ...ec, name: e.target.value })} />
            <Input placeholder="Phone" value={ec.phone} onChange={(e) => setEc({ ...ec, phone: e.target.value })} />
            <Button size="icon" type="submit"><Plus /></Button>
          </form>
        </Panel>

        <Panel title="Profile" icon={<User className="h-4 w-4" />}>
          <form className="space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("profiles").update({ full_name: p.full_name.trim().slice(0, 100), phone: p.phone.trim().slice(0, 20) }).eq("id", uid!);
            if (error) return toast.error(error.message);
            toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["me"] });
          }}>
            <Input value={p.full_name} onChange={(e) => setProf({ ...p, full_name: e.target.value })} placeholder="Full name" />
            <Input value={p.phone} onChange={(e) => setProf({ ...p, phone: e.target.value })} placeholder="Phone" />
            <p className="text-xs text-muted-foreground">{me.data?.user.email}</p>
            <Button type="submit" size="sm">Save</Button>
          </form>
        </Panel>

        <Panel title="Help & support" icon={<Headphones className="h-4 w-4" />}>
          <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> 24/7 support · Report a driver or problem</p>
          <form className="space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            if (help.trim().length < 5) return toast.error("Tell us a bit more");
            const { error } = await supabase.from("complaints").insert({ user_id: uid!, message: help.trim().slice(0, 1000), ride_id: upcoming?.id ?? history[0]?.id ?? null });
            if (error) return toast.error(error.message);
            setHelp(""); toast.success("Report sent. We'll get back to you soon.");
          }}>
            <Textarea value={help} onChange={(e) => setHelp(e.target.value)} placeholder="Describe the issue or report a driver" maxLength={1000} />
            <Button type="submit" size="sm" variant="outline">Send report</Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
