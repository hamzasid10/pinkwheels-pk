import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, Panel, StatusPill } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { pkr, STATUS_LABEL, useMe, type RideStatus } from "@/lib/pink";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Pink Wheel" }, { name: "description", content: "Pink Wheel admin panel." }] }),
  component: AdminPage,
});

const STATUSES = Object.keys(STATUS_LABEL) as RideStatus[];

function AdminPage() {
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const q = useQuery({
    queryKey: ["admin-all"], enabled: isAdmin, refetchInterval: 10000,
    queryFn: async () => {
      const [drivers, vehicles, docs, rides, profiles, roles, complaints] = await Promise.all([
        supabase.from("drivers").select("*").order("created_at", { ascending: false }),
        supabase.from("vehicles").select("*"),
        supabase.from("driver_documents").select("*"),
        supabase.from("ride_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      ]);
      return {
        drivers: drivers.data ?? [], vehicles: vehicles.data ?? [], docs: docs.data ?? [], rides: rides.data ?? [],
        profiles: profiles.data ?? [], roles: roles.data ?? [], complaints: complaints.data ?? [],
      };
    },
  });

  if (me.isLoading) return <AppShell title="Admin"><p>Loading…</p></AppShell>;
  if (!isAdmin) return <AppShell title="Admin"><Panel>You don't have admin access.</Panel></AppShell>;
  const d = q.data;
  if (!d) return <AppShell title="Admin"><p>Loading…</p></AppShell>;

  const riderIds = new Set(d.roles.filter((r) => r.role === "rider").map((r) => r.user_id));
  const riders = d.profiles.filter((p) => riderIds.has(p.id));
  const approved = d.drivers.filter((x) => x.status === "approved");
  const veh = (id: string) => d.vehicles.find((v) => v.driver_id === id);
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) return toast.error(error.message);
    toast.success(ok); q.refetch();
  };
  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("driver-docs").createSignedUrl(path, 300);
    if (data) window.open(data.signedUrl, "_blank");
  };

  const stats = [
    ["Total riders", riders.length], ["Total drivers", d.drivers.length],
    ["Pending applications", d.drivers.filter((x) => x.status === "pending").length],
    ["Active rides", d.rides.filter((r) => !["completed", "cancelled"].includes(r.status)).length],
    ["Completed rides", d.rides.filter((r) => r.status === "completed").length],
    ["Cancelled rides", d.rides.filter((r) => r.status === "cancelled").length],
  ];

  return (
    <AppShell title="Admin dashboard">
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="font-display text-3xl font-semibold">{v}</p>
            <p className="text-xs text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <Tabs defaultValue="rides">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-2xl">
          <TabsTrigger value="rides">Ride bookings</TabsTrigger>
          <TabsTrigger value="drivers">Driver verification</TabsTrigger>
          <TabsTrigger value="riders">Riders</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
          <TabsTrigger value="sos">Emergency</TabsTrigger>
        </TabsList>

        <TabsContent value="rides" className="space-y-3">
          {d.rides.length === 0 && <Panel>No bookings yet.</Panel>}
          {d.rides.map((r) => (
            <Panel key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.booking_code} · {r.rider_name} · {r.rider_phone}</p>
                <StatusPill status={r.status as RideStatus} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.pickup} → {r.destination} · {r.ride_date} {r.ride_time.slice(0, 5)} · <span className="capitalize">{r.vehicle}</span> · {pkr(r.fare)}</p>
              <p className="text-sm text-muted-foreground">Emergency: {r.emergency_contact} · Driver: {r.driver_name ?? "—"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select className="h-9 rounded-full border bg-card px-3 text-sm" value={r.driver_id ?? ""} onChange={(e) => {
                  const dr = approved.find((x) => x.user_id === e.target.value);
                  if (!dr) return;
                  const v = veh(dr.user_id);
                  run(supabase.from("ride_requests").update({
                    driver_id: dr.user_id, driver_name: dr.full_name, driver_phone: dr.phone,
                    driver_vehicle: v ? `${v.make_model} · ${v.reg_no}` : null,
                    status: r.status === "requested" ? "driver_assigned" : r.status,
                  }).eq("id", r.id), "Driver assigned");
                }}>
                  <option value="">Assign driver…</option>
                  {approved.map((x) => <option key={x.user_id} value={x.user_id}>{x.full_name} ({veh(x.user_id)?.kind ?? "?"}){x.online ? " • online" : ""}</option>)}
                </select>
                <select className="h-9 rounded-full border bg-card px-3 text-sm" value={r.status} onChange={(e) =>
                  run(supabase.from("ride_requests").update({ status: e.target.value as RideStatus }).eq("id", r.id), "Status updated")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </Panel>
          ))}
        </TabsContent>

        <TabsContent value="drivers" className="space-y-3">
          {d.drivers.length === 0 && <Panel>No driver applications yet.</Panel>}
          {d.drivers.map((x) => {
            const v = veh(x.user_id);
            return (
              <Panel key={x.user_id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{x.full_name} · {x.city}</p>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold capitalize text-accent-foreground">{x.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{x.phone} · {x.email} · CNIC {x.cnic} · Licence {x.licence_no}</p>
                <p className="text-sm text-muted-foreground">{v ? `${v.kind} · ${v.make_model} · ${v.reg_no}` : "No vehicle"} · Hours: {x.working_hours}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.docs.filter((doc) => doc.driver_id === x.user_id).map((doc) => (
                    <Button key={doc.id} size="sm" variant="outline" onClick={() => openDoc(doc.file_path)}>View {doc.doc_type}</Button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={async () => {
                    await run(supabase.from("drivers").update({ status: "approved" }).eq("user_id", x.user_id), "Driver approved");
                    await supabase.from("driver_documents").update({ verified: true }).eq("driver_id", x.user_id);
                  }}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => run(supabase.from("drivers").update({ status: "rejected" }).eq("user_id", x.user_id), "Driver rejected")}>Reject</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run(supabase.from("drivers").update({ status: "suspended", online: false }).eq("user_id", x.user_id), "Driver suspended")}>Suspend</Button>
                </div>
              </Panel>
            );
          })}
        </TabsContent>

        <TabsContent value="riders">
          <Panel>
            {riders.length === 0 ? <p className="text-sm text-muted-foreground">No riders yet.</p> : (
              <ul className="divide-y">
                {riders.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span><b>{p.full_name || "Unnamed"}</b> · {p.phone ?? "—"} {p.suspended && <span className="text-destructive">· suspended</span>}</span>
                    <Button size="sm" variant="outline" onClick={() => run(supabase.from("profiles").update({ suspended: !p.suspended }).eq("id", p.id), p.suspended ? "Rider restored" : "Rider suspended")}>
                      {p.suspended ? "Unsuspend" : "Suspend"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {(["complaint", "emergency"] as const).map((kind) => (
          <TabsContent key={kind} value={kind === "complaint" ? "complaints" : "sos"} className="space-y-3">
            {d.complaints.filter((c) => c.kind === kind).length === 0 && <Panel>Nothing here.</Panel>}
            {d.complaints.filter((c) => c.kind === kind).map((c) => {
              const who = d.profiles.find((p) => p.id === c.user_id);
              const ride = d.rides.find((r) => r.id === c.ride_id);
              return (
                <Panel key={c.id} className={kind === "emergency" && !c.resolved ? "border-destructive" : ""}>
                  <p className="font-semibold">{who?.full_name || "User"} · {who?.phone ?? ""}</p>
                  <p className="text-sm">{c.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()} {ride && `· Ride ${ride.booking_code}`}</p>
                  <Button size="sm" className="mt-2" variant={c.resolved ? "outline" : "default"} disabled={c.resolved}
                    onClick={() => run(supabase.from("complaints").update({ resolved: true }).eq("id", c.id), "Marked resolved")}>
                    {c.resolved ? "Resolved" : "Mark resolved"}
                  </Button>
                </Panel>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
