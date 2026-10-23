import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, CarFront, Home, Inbox, Route as RouteIcon, ShieldCheck, User, Users, Wallet, History } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type RideStatus } from "@/lib/pink";
import { driverGate, effectiveMode, hasActiveTrip, MODE_KEY, SESSION_KEY, type AppMode } from "@/lib/mode";
import { cn } from "@/lib/utils";
import { ACTIVE_DRIVER_STATUSES } from "@/lib/ride-dispatch";

const listeners = new Set<() => void>();

export function useMode() {
  const me = useMe();
  const uid = me.data?.user.id;
  const qc = useQueryClient();
  const [stored, setStored] = useState<AppMode | null>(null);
  useEffect(() => {
    const read = () => setStored((localStorage.getItem(MODE_KEY) as AppMode | null) ?? null);
    read(); listeners.add(read);
    return () => { listeners.delete(read); };
  }, []);
  const driver = useQuery({
    queryKey: ["mode-driver", uid], enabled: !!uid,
    queryFn: async () => { if (!uid) return null; const { data, error } = await supabase.from("drivers").select("status, online, current_mode").eq("user_id", uid).maybeSingle(); if (error) throw error; return data; },
  });
  const gate = driverGate(driver.data?.status, !!me.data?.profile?.suspended);
  const mode = effectiveMode(driver.data?.current_mode === "driver" ? "driver" : driver.data ? "passenger" : stored, gate);
  useEffect(() => {
    if (!uid) return;
    const channel = supabase.channel(`mode-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers", filter: `user_id=eq.${uid}` }, () => {
        void qc.invalidateQueries({ queryKey: ["mode-driver", uid] });
        void qc.invalidateQueries({ queryKey: ["driver", uid] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [uid, qc]);

  // New app session: always start offline for safety.
  useEffect(() => {
    if (!uid || !driver.data?.online || sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    supabase.from("drivers").update({ online: false }).eq("user_id", uid).then(() => { qc.invalidateQueries(); });
  }, [uid, driver.data?.online, qc]);
  useEffect(() => { if (uid && driver.isFetched) sessionStorage.setItem(SESSION_KEY, "1"); }, [uid, driver.isFetched]);

  async function save(m: AppMode) {
    if (uid && driver.data) {
      const { error } = await supabase.from("drivers").update({ current_mode: m, ...(m === "passenger" ? { online: false } : {}) }).eq("user_id", uid);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["mode-driver", uid] });
    }
    localStorage.setItem(MODE_KEY, m); listeners.forEach((l) => l());
  }

  async function goOffline() {
    if (uid && driver.data?.online) { await supabase.from("drivers").update({ online: false }).eq("user_id", uid); qc.invalidateQueries(); }
  }

  async function activeTrip() {
    if (!uid) return false;
    const [r, p] = await Promise.all([
      supabase.from("ride_requests").select("status").eq("driver_id", uid).in("status", ACTIVE_DRIVER_STATUSES as RideStatus[]),
      supabase.from("pool_routes").select("status").eq("driver_id", uid).eq("status", "started"),
    ]);
    return hasActiveTrip((r.data ?? []).map((x) => x.status), (p.data ?? []).map((x) => x.status));
  }

  return { mode, gate, uid, loading: me.isLoading || driver.isLoading, save, goOffline, activeTrip };
}

const GATE_COPY: Record<string, { title: string; body: string }> = {
  not_applied: { title: "Become a Pink Wheel Driver", body: "Complete your driver registration to start accepting rides and earning with Pink Wheel." },
  pending: { title: "Driver Verification Pending", body: "Your driver profile is currently under review. We'll let you know when you're approved." },
  rejected: { title: "Driver application not approved", body: "Your driver application wasn't approved, so Driver Mode isn't available. Contact support if you think this is a mistake." },
  suspended: { title: "Driver account suspended", body: "Driver Mode is unavailable while your account is suspended. Please contact support." },
};

/** Shared switch logic + gate dialog. */
export function useModeSwitch() {
  const m = useMode();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function switchTo(target: AppMode) {
    if (busy || target === m.mode) return;
    if (target === "driver") {
      if (m.gate !== "approved") return setDialog(m.gate);
      setBusy(true);
      try { await m.save("driver"); navigate({ to: "/driver" }); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't switch modes"); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      if (await m.activeTrip()) return toast.error("Complete your current trip before switching modes.");
      await m.goOffline();
      await m.save("passenger");
      navigate({ to: "/book" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't switch modes"); } finally { setBusy(false); }
  }

  const ui = (
    <AlertDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog && GATE_COPY[dialog]?.title}</AlertDialogTitle>
          <AlertDialogDescription>{dialog && GATE_COPY[dialog]?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dialog === "not_applied" ? "Cancel" : "Close"}</AlertDialogCancel>
          {dialog === "not_applied" && <AlertDialogAction onClick={() => navigate({ to: "/driver-register" })}>Apply as Driver</AlertDialogAction>}
          {dialog === "pending" && <AlertDialogAction onClick={() => navigate({ to: "/driver-register" })}>View application</AlertDialogAction>}
          {(dialog === "rejected" || dialog === "suspended") && <AlertDialogAction onClick={() => navigate({ to: "/contact" })}>Contact support</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ...m, busy, switchTo, ui };
}

/** Compact "Passenger [toggle] Driver" switch for headers. */
export function ModeToggle({ className }: { className?: string }) {
  const s = useModeSwitch();
  if (!s.uid) return null;
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold", className)}>
      <span className={s.mode === "passenger" ? "text-primary" : "text-muted-foreground"}>Passenger</span>
      <Switch aria-label="Driver Mode" checked={s.mode === "driver"} disabled={s.busy} onCheckedChange={(v) => s.switchTo(v ? "driver" : "passenger")} className="scale-75" />
      <span className={s.mode === "driver" ? "text-primary" : "text-muted-foreground"}>Driver</span>
      {s.ui}
    </div>
  );
}

/** "You are currently using Pink Wheel as" card. */
export function ModeCard({ className }: { className?: string }) {
  const s = useModeSwitch();
  if (!s.uid || s.loading) return null;
  const driver = s.mode === "driver";
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card", className)}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">{driver ? <CarFront className="h-5 w-5" /> : <Car className="h-5 w-5" />}</span>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">You are currently using Pink Wheel as</p><p className="font-semibold">{driver ? "Driver" : "Passenger"}</p></div>
      </div>
      <Button size="sm" variant="outline" disabled={s.busy} onClick={() => s.switchTo(driver ? "passenger" : "driver")}>
        Switch to {driver ? "Passenger" : "Driver"} Mode
      </Button>
      {s.ui}
    </div>
  );
}

type NavItem = { label: string; to: string; hash?: string; icon: typeof Home };
export const PASSENGER_NAV: NavItem[] = [
  { label: "Home", to: "/book", icon: Home },
  { label: "Pink Pool", to: "/pool", icon: Users },
  { label: "Trips", to: "/rider", icon: History },
  { label: "Safety", to: "/safety", icon: ShieldCheck },
  { label: "Profile", to: "/account", icon: User },
];
export const DRIVER_NAV: NavItem[] = [
  { label: "Home", to: "/driver", icon: Home },
  { label: "Requests", to: "/driver", hash: "driver-rides", icon: Inbox },
  { label: "Routes", to: "/driver", hash: "driver-pool", icon: RouteIcon },
  { label: "Earnings", to: "/driver", hash: "driver-earnings", icon: Wallet },
  { label: "Profile", to: "/account", icon: User },
];

/** Mobile bottom navigation that follows the current mode. */
export function BottomNav() {
  const { mode, uid } = useMode();
  if (!uid) return null;
  const items = mode === "driver" ? DRIVER_NAV : PASSENGER_NAV;
  return (
    <nav aria-label={`${mode} navigation`} className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((it) => (
          <li key={it.label}>
            <Link to={it.to} {...(it.hash ? { hash: it.hash } : {})} activeOptions={{ includeHash: !!it.hash, exact: true }}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted-foreground data-[status=active]:text-primary">
              <it.icon className="h-5 w-5" />{it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
