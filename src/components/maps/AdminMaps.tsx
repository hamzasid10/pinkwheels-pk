import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Panel } from "@/components/Brand";
import { GoogleMap, type MapPin } from "@/components/maps/GoogleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CITIES } from "@/lib/maps/cities";
import { pkr, routeFare, useFares, VEHICLES, type Vehicle } from "@/lib/pink";

export function AdminFares() {
  const fares = useFares();
  const [draft, setDraft] = useState<Record<string, { base_fare: string; per_km: string; per_min: string; min_fare: string }>>({});
  useEffect(() => {
    const m: typeof draft = {};
    for (const v of VEHICLES) {
      const f = fares.data?.find((x) => x.vehicle === v.id);
      m[v.id] = { base_fare: f ? String(f.base_fare) : "", per_km: f ? String(f.per_km) : "", per_min: f ? String(f.per_min) : "", min_fare: f ? String(f.min_fare) : "" };
    }
    setDraft(m);
  }, [fares.data]);

  async function save(v: Vehicle) {
    const x = draft[v];
    if (!x) return;
    const n = { base_fare: Number(x.base_fare), per_km: Number(x.per_km), per_min: Number(x.per_min || 0), min_fare: Number(x.min_fare || 0) };
    if (!x.base_fare || !x.per_km || Object.values(n).some((y) => !Number.isFinite(y) || y < 0)) return toast.error("Enter valid non-negative numbers");
    const { error } = await supabase.from("fare_settings").upsert({ vehicle: v, ...n, base_fare: Math.round(n.base_fare), min_fare: Math.round(n.min_fare), updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Fare saved"); fares.refetch();
  }

  return (
    <div className="space-y-3">
      <Panel><p className="text-sm text-muted-foreground">Fare = base + (per km × distance) + (per minute × travel time), never below the minimum, rounded to Rs 10. Riders see "Fare not set yet" until you save a vehicle.</p></Panel>
      {VEHICLES.map((v) => {
        const x = draft[v.id];
        if (!x) return null;
        const f = fares.data?.find((y) => y.vehicle === v.id);
        const sample = routeFare(f, 10, 25);
        return (
          <Panel key={v.id} title={v.label}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([["base_fare", "Base fare (Rs)"], ["per_km", "Per km (Rs)"], ["per_min", "Per minute (Rs)"], ["min_fare", "Minimum fare (Rs)"]] as const).map(([k, l]) => (
                <div key={k}><Label>{l}</Label><Input inputMode="decimal" value={x[k]} onChange={(e) => setDraft({ ...draft, [v.id]: { ...x, [k]: e.target.value } })} /></div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{sample != null ? `Example: 10 km / 25 min = ${pkr(sample)}` : "Not set — riders can't book this vehicle yet."}</p>
              <Button size="sm" onClick={() => save(v.id)}>Save</Button>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

export function AdminLiveMap({ drivers }: { drivers: { user_id: string; full_name: string; online: boolean }[] }) {
  const locs = useQuery({
    queryKey: ["admin-locs"], refetchInterval: 15000,
    queryFn: async () => (await supabase.from("driver_locations").select("*")).data ?? [],
  });
  const fresh = (locs.data ?? []).filter((l) => Date.now() - new Date(l.updated_at).getTime() < 10 * 60000);
  const pins = useMemo<MapPin[]>(() => fresh.map((l) => ({
    id: l.driver_id, pos: { lat: l.lat, lng: l.lng }, kind: "driver",
    label: drivers.find((d) => d.user_id === l.driver_id)?.full_name ?? "Driver",
  })), [fresh, drivers]);
  return (
    <Panel title={`Live drivers (${fresh.length})`}>
      <GoogleMap className="h-[420px]" pins={pins} center={{ lat: CITIES[0].lat, lng: CITIES[0].lng }} fitKey={String(pins.length)} />
      <p className="mt-2 text-xs text-muted-foreground">Shows drivers who shared their location in the last 10 minutes. Hover a dot for her name.</p>
    </Panel>
  );
}
