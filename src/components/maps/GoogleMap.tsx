import { useEffect, useRef, useState } from "react";
import { CITIES, decodePolyline, type LatLng } from "@/lib/maps/cities";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { __pwMapsInit?: () => void; google?: any }
}

let loader: Promise<any> | null = null;
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (loader) return loader;
  const env = import.meta.env as Record<string, string | undefined>;
  const channel = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
  const host = window.location.hostname;
  const lovableHost = /(\.lovable\.app|\.lovableproject\.com|^localhost)$/.test(host) || host === "localhost";
  const keyPromise: Promise<string | null | undefined> = lovableHost
    ? Promise.resolve(env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"])
    : import("@/lib/maps/browser-key.functions").then((m) => m.getMapsBrowserKey()).then((r) => r.key ?? env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"]);
  loader = keyPromise.then((key) => new Promise((resolve, reject) => {
    if (!key) { loader = null; reject(new Error("Map key missing")); return; }
    window.__pwMapsInit = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__pwMapsInit&channel=${channel}&region=PK&language=en`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("Map failed to load")); };
    document.head.appendChild(s);
  }));
  return loader;
}

export type MapPin = { id: string; pos: LatLng; kind: "pickup" | "dropoff" | "driver" | "car" | "scooty" | "bike"; draggable?: boolean; label?: string };

const PIN_COLOR: Record<MapPin["kind"], string> = {
  pickup: "#2f9e6e", dropoff: "#c2416b", driver: "#c2416b", car: "#d9668f", scooty: "#d9668f", bike: "#d9668f",
};

function icon(g: any, kind: MapPin["kind"]) {
  const vehicle = kind === "car" || kind === "scooty" || kind === "bike" || kind === "driver";
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: vehicle ? 7 : 9,
    fillColor: PIN_COLOR[kind],
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };
}

const STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "simplified" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#f6dbe5" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#fdf6f8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8e1ea" }] },
];

function isCredentialedPreview() {
  return /-devserver-/.test(window.location.hostname);
}

export function GoogleMap({
  pins = [], polyline, onPinDrag, onMapClick, className, fitKey, center,
}: {
  pins?: MapPin[] | undefined;
  polyline?: string | null | undefined;
  onPinDrag?: ((id: string, pos: LatLng) => void) | undefined;
  onMapClick?: ((pos: LatLng) => void) | undefined;
  className?: string | undefined;
  /** Changing this re-fits the map to all pins + route. */
  fitKey?: string | undefined;
  center?: LatLng | undefined;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const line = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dragRef = useRef(onPinDrag); dragRef.current = onPinDrag;
  const clickRef = useRef(onMapClick); clickRef.current = onMapClick;

  useEffect(() => {
    if (isCredentialedPreview()) { setErr("Map preview isn't available on this link. Open the app preview or published site to see the live map."); return; }
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !el.current) return;
      const c = center ?? { lat: CITIES[0].lat, lng: CITIES[0].lng };
      map.current = new g.maps.Map(el.current, {
        center: c, zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        gestureHandling: "greedy", styles: STYLES,
        restriction: { latLngBounds: { north: 37.2, south: 23.5, west: 60.8, east: 77.9 }, strictBounds: false },
      });
      map.current.addListener("click", (e: any) => clickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
      setReady(true);
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reconcile markers
  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id);
      let m = markers.current.get(p.id);
      if (!m) {
        m = new g.maps.Marker({ map: map.current, position: p.pos, draggable: !!p.draggable, icon: icon(g, p.kind), title: p.label });
        m.addListener("dragend", (e: any) => dragRef.current?.(p.id, { lat: e.latLng.lat(), lng: e.latLng.lng() }));
        markers.current.set(p.id, m);
      } else {
        m.setPosition(p.pos);
        m.setDraggable(!!p.draggable);
      }
    }
    for (const [id, m] of markers.current) if (!seen.has(id)) { m.setMap(null); markers.current.delete(id); }
  }, [ready, pins]);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    line.current?.setMap(null);
    line.current = null;
    if (polyline) {
      line.current = new g.maps.Polyline({ map: map.current, path: decodePolyline(polyline), strokeColor: "#c2416b", strokeOpacity: 0.9, strokeWeight: 5 });
    }
  }, [ready, polyline]);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    const pts: LatLng[] = [...pins.filter((p) => p.kind === "pickup" || p.kind === "dropoff" || p.kind === "driver").map((p) => p.pos), ...(polyline ? decodePolyline(polyline) : [])];
    if (pts.length === 1) { map.current.panTo(pts[0]); map.current.setZoom(15); }
    else if (pts.length > 1) {
      const b = new g.maps.LatLngBounds();
      pts.forEach((p) => b.extend(p));
      map.current.fitBounds(b, { top: 60, bottom: 60, left: 40, right: 40 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  useEffect(() => { if (ready && center) map.current.panTo(center); }, [ready, center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-blush", className)}>
      <div ref={el} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {err ?? "Loading map…"}
        </div>
      )}
    </div>
  );
}
