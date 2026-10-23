import { useEffect, useRef, useState } from "react";
import { CITIES, decodePolyline, type LatLng } from "@/lib/maps/cities";
import { cn } from "@/lib/utils";
import { LocateFixed, Minus, Plus, ShieldCheck } from "lucide-react";

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

export type MapPin = { id: string; pos: LatLng; kind: "pickup" | "dropoff" | "driver" | "car" | "scooty" | "bike" | "me"; draggable?: boolean; label?: string };

const GLYPH: Record<string, string> = {
  car: '<path d="M9 21h14l-1.6-4.6A2 2 0 0 0 19.5 15h-7a2 2 0 0 0-1.9 1.4Z M8 21v3h2v-1.5h12V24h2v-3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>',
  scooty: '<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="22" r="2.2"/><circle cx="21.5" cy="22" r="2.2"/><path d="M13 22h6l2-6h-2.5M18 16l-3 6"/></g>',
  bike: '<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="21.5" r="2.6"/><circle cx="21.5" cy="21.5" r="2.6"/><path d="M10.5 21.5l4-5h4l3 5M14 14h3"/></g>',
};

function svgIcon(g: any, kind: MapPin["kind"], dim: boolean) {
  let svg = "", size = 32;
  if (kind === "pickup" || kind === "dropoff") {
    const c = kind === "pickup" ? "#2f9e6e" : "#c2416b";
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="11" fill="${c}" stroke="#fff" stroke-width="4"/>${kind === "dropoff" ? '<rect x="12.5" y="12.5" width="7" height="7" fill="#fff"/>' : '<circle cx="16" cy="16" r="3.5" fill="#fff"/>'}</svg>`;
  } else if (kind === "me") {
    size = 40;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#c6658a" fill-opacity=".18"/><circle cx="20" cy="20" r="9" fill="#fff" stroke="#c6658a" stroke-width="4"/></svg>`;
  } else {
    const v = kind === "driver" ? "car" : kind;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" opacity="${dim ? 0.35 : 1}"><circle cx="16" cy="16" r="15" fill="#d9668f" fill-opacity=".22"/><circle cx="16" cy="16" r="11.5" fill="#c6658a" stroke="#fff" stroke-width="2"/><g transform="translate(16 16) scale(.62) translate(-16 -19)">${GLYPH[v]}</g></svg>`;
  }
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new g.maps.Size(size, size), anchor: new g.maps.Point(size / 2, size / 2) };
}

const STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#eef3ec" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#fbf8f9" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#f3dce6" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#f1eef0" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fbe4ec" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7d7177" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
];

function isCredentialedPreview() {
  return /-devserver-/.test(window.location.hostname);
}

export function GoogleMap({
  pins = [], polyline, onPinDrag, onMapClick, className, fitKey, center, emphasize, controls, onLocate, children,
}: {
  /** Fade vehicle markers that aren't this kind. */
  emphasize?: string | undefined;
  /** Show floating zoom + locate controls. */
  controls?: boolean | undefined;
  onLocate?: ((pos: LatLng) => void) | undefined;
  children?: React.ReactNode;
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
  const [me, setMe] = useState<LatLng | null>(null);
  const [picked, setPicked] = useState<MapPin | null>(null);
  const pinsRef = useRef(pins); pinsRef.current = pins;

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setMe(pos);
      map.current?.panTo(pos); map.current?.setZoom(15);
      onLocate?.(pos);
    }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
  }
  const zoom = (d: number) => map.current?.setZoom((map.current.getZoom() ?? 12) + d);

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
    const all: MapPin[] = me ? [...pins, { id: "__me", pos: me, kind: "me", label: "You are here" }] : pins;
    for (const p of all) {
      const dim = !!emphasize && ["car", "scooty", "bike"].includes(p.kind) && p.kind !== emphasize;
      seen.add(p.id);
      let m = markers.current.get(p.id);
      if (!m) {
        m = new g.maps.Marker({ map: map.current, position: p.pos, draggable: !!p.draggable, icon: svgIcon(g, p.kind, dim), title: p.label, zIndex: p.kind === "me" ? 5 : p.kind === "pickup" || p.kind === "dropoff" ? 10 : 1, ...(["car", "scooty", "bike"].includes(p.kind) ? { animation: g.maps.Animation.DROP } : {}) });
        m.addListener("click", () => { const cur = pinsRef.current.find((x) => x.id === p.id); if (cur && ["car", "scooty", "bike", "driver"].includes(cur.kind)) setPicked(cur); });
        m.addListener("dragend", (e: any) => dragRef.current?.(p.id, { lat: e.latLng.lat(), lng: e.latLng.lng() }));
        markers.current.set(p.id, m);
      } else {
        m.setPosition(p.pos);
        m.setDraggable(!!p.draggable);
        m.setIcon(svgIcon(g, p.kind, dim));
      }
    }
    for (const [id, m] of markers.current) if (!seen.has(id)) { m.setMap(null); markers.current.delete(id); }
  }, [ready, pins, me, emphasize]);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    (line.current as any[] | null)?.forEach((l) => l.setMap(null));
    line.current = null;
    if (polyline) {
      const path = decodePolyline(polyline);
      line.current = [
        new g.maps.Polyline({ map: map.current, path, strokeColor: "#ffffff", strokeOpacity: 1, strokeWeight: 9, zIndex: 1 }),
        new g.maps.Polyline({ map: map.current, path, strokeColor: "#c6658a", strokeOpacity: 1, strokeWeight: 5, zIndex: 2 }),
      ];
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
      {ready && controls && (
        <div className="map-controls absolute right-3 z-10 flex flex-col gap-2">
          <button type="button" aria-label="My location" onClick={locate} className="map-fab"><LocateFixed className="h-4 w-4 text-primary" /></button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1)} className="map-fab"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(-1)} className="map-fab"><Minus className="h-4 w-4" /></button>
        </div>
      )}
      {picked && (
        <button type="button" onClick={() => setPicked(null)} className="animate-fade-in absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-2xl bg-card px-4 py-2.5 text-left text-xs shadow-card">
          <span className="flex items-center gap-1 font-semibold text-foreground"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Verified female driver</span>
          <span className="mt-0.5 block capitalize text-muted-foreground">{picked.kind === "driver" ? "Your driver" : picked.kind} · available nearby</span>
        </button>
      )}
      {children}
      {!ready && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {err ?? "Loading map…"}
        </div>
      )}
    </div>
  );
}
