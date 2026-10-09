export type LatLng = { lat: number; lng: number };

export const CITIES = [
  { id: "lahore", name: "Lahore", lat: 31.5204, lng: 74.3587 },
  { id: "gujranwala", name: "Gujranwala", lat: 32.1877, lng: 74.1945 },
  { id: "islamabad", name: "Islamabad", lat: 33.6844, lng: 73.0479 },
  { id: "rawalpindi", name: "Rawalpindi", lat: 33.5651, lng: 73.0169 },
] as const;

export type CityId = (typeof CITIES)[number]["id"];

/** Bounding box covering all four launch cities (used to bias/restrict searches). */
export const SERVICE_BOUNDS = { low: { latitude: 31.2, longitude: 72.7 }, high: { latitude: 33.95, longitude: 74.7 } };

export function inServiceArea(p: LatLng) {
  return p.lat >= SERVICE_BOUNDS.low.latitude && p.lat <= SERVICE_BOUNDS.high.latitude
    && p.lng >= SERVICE_BOUNDS.low.longitude && p.lng <= SERVICE_BOUNDS.high.longitude;
}

export function nearestCity(p: LatLng) {
  return [...CITIES].sort((a, b) => km(p, a) - km(p, b))[0];
}

export function km(a: LatLng, b: LatLng) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Decode a Google encoded polyline. */
export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

/** Shortest distance (km) from point p to a polyline path. */
export function distanceToPath(p: LatLng, path: LatLng[]) {
  if (!path.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < path.length; i += Math.max(1, Math.floor(path.length / 400))) best = Math.min(best, km(p, path[i]));
  return best;
}

/** Index position along path closest to p (for direction checks). */
export function pathIndex(p: LatLng, path: LatLng[]) {
  let best = Infinity, idx = -1;
  path.forEach((q, i) => { const d = km(p, q); if (d < best) { best = d; idx = i; } });
  return idx;
}
