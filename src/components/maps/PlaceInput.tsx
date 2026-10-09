import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { placeAutocomplete, placeDetails, reverseGeocode } from "@/lib/maps/maps.functions";
import type { LatLng } from "@/lib/maps/cities";
import { cn } from "@/lib/utils";

export type Place = { address: string; lat: number; lng: number; placeId: string | null };

type Sug = { placeId: string; main: string; secondary: string; text: string };

export function PlaceInput({
  value, onChange, placeholder, near, allowGps, dot = "pickup",
}: {
  value: Place | null;
  onChange: (p: Place | null) => void;
  placeholder: string;
  near?: LatLng | undefined;
  allowGps?: boolean | undefined;
  dot?: "pickup" | "dropoff" | undefined;
}) {
  const auto = useServerFn(placeAutocomplete);
  const details = useServerFn(placeDetails);
  const [text, setText] = useState(value?.address ?? "");
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = useRef<string>(crypto.randomUUID());
  const reqId = useRef(0);
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setText(value?.address ?? ""); }, [value?.address]);

  useEffect(() => {
    if (!dirty.current) return;
    const q = text.trim();
    if (q.length < 2) { setSugs([]); return; }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await auto({ data: { input: q, sessionToken: token.current, near } });
        if (id === reqId.current) { setSugs(res); setOpen(true); }
      } catch (e) {
        if (id === reqId.current) toast.error((e as Error).message);
      } finally { if (id === reqId.current) setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  async function pick(s: Sug) {
    setOpen(false); dirty.current = false; setText(s.text);
    try {
      const d = await details({ data: { placeId: s.placeId, sessionToken: token.current } });
      onChange({ address: d.address || s.text, lat: d.lat, lng: d.lng, placeId: d.placeId });
    } catch (e) { toast.error((e as Error).message); }
    token.current = crypto.randomUUID();
  }

  return (
    <div className="relative">
      <span className={cn("absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full", dot === "pickup" ? "bg-success" : "bg-primary-foreground ring-2 ring-primary")} />
      <Input
        value={text}
        placeholder={placeholder}
        onChange={(e) => { dirty.current = true; setText(e.target.value); if (!e.target.value) onChange(null); }}
        onFocus={() => sugs.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn("h-12 rounded-2xl pl-8", allowGps && "pr-11")}
      />
      {loading && <Loader2 className="absolute right-12 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {allowGps && <GpsButton onPlace={(p) => { dirty.current = false; onChange(p); }} />}
      {open && sugs.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {sugs.map((s) => (
            <li key={s.placeId}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span><span className="block text-sm font-medium">{s.main}</span><span className="block text-xs text-muted-foreground">{s.secondary}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GpsButton({ onPlace }: { onPlace: (p: Place) => void }) {
  const rev = useServerFn(reverseGeocode);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!("geolocation" in navigator)) return toast.error("Your device can't share location.");
    const ok = window.confirm("Pink Wheel would like to use your current location to set your pickup. Allow?");
    if (!ok) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const r = await rev({ data: p });
        onPlace({ ...p, address: r.address, placeId: r.placeId });
      } catch (e) { toast.error((e as Error).message); }
      setBusy(false);
    }, (e) => { setBusy(false); toast.error(e.code === 1 ? "Location permission was denied." : "Couldn't get your location."); }, { enableHighAccuracy: true, timeout: 12000 });
  }
  return (
    <button type="button" onClick={go} aria-label="Use my current location"
      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-accent text-primary">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
    </button>
  );
}
