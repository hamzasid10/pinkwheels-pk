const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export async function mapsFetch(path: string, init: { method?: string; body?: unknown; fieldMask?: string } = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps is not connected yet.");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers,
    body: init.body ? JSON.stringify(init.body) : null,
  });
  if (res.status === 403) {
    const text = await res.text();
    console.error(`Maps 403: ${text}`);
    if (text.includes("API_KEY_HTTP_REFERRER_BLOCKED")) throw new Error("Google Maps server key is referrer-restricted. Set its application restriction to None or IP addresses.");
    if (text.includes("API_KEY_SERVICE_BLOCKED")) throw new Error("Google Maps server key does not allow this API. Add it to the key's allowed APIs.");
    throw new Error("Google Maps request was denied (403).");
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`Maps request failed [${res.status}]: ${text}`);
    throw new Error(`Maps request failed [${res.status}]`);
  }
  return res.json();
}
