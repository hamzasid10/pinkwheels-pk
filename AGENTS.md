<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- AI calls live in src/lib/ai/*.server.ts (Lovable AI Gateway, Responses API, streamed + structured output) and are exposed via auth-protected *.functions.ts server fns — keeps the key and prompts server-only.
- Google Maps: browser key only renders maps (src/components/maps/GoogleMap.tsx); Places, geocoding and Routes go through auth-protected server fns in src/lib/maps/maps.functions.ts via the connector gateway — keeps billable calls authenticated and keys server-side.
- Ride fares are computed from the admin-editable fare_settings table and re-computed by a DB trigger on insert — never trust client fares or hardcode prices.
- Ride dispatch uses the existing ride_requests plus private ride_offers, database-owned matching and atomic RPC acceptance; persisted drivers.current_mode and online govern eligibility, with realtime and reconciliation polling to recover missed events.
- Driver live location lives in driver_locations (RLS: own write while online+consented, assigned rider/admin read); public nearby view only via the nearby_drivers() RPC returning rounded coords.
- Use the shared Logo variants for application branding and BrandSplash for route loading; keep home-screen support manifest-only without offline caching so previews remain reliable.
- MCP server lives in src/lib/mcp (one tool per file, OAuth via the backend's auth issuer, queries run with the caller's token so RLS applies) — external assistants act strictly as the signed-in user.
- Driver profile stays on /driver with DriverProfile as its focused presentation module; existing ride and pool controls remain below it to preserve operational workflows without duplicate pages.
- Driver profile totals aggregate completed ride fares and completed owned pool seats as gross earnings, counting pool journeys once; no reviews means an unrated display rather than a seeded rating.

- Default rider entry uses /dashboard → /book with the existing map-based booking flow; /rider remains ride history/tracking and explicit auth return paths take priority, preserving role-specific access and avoiding duplicate pages.
- SOS: SafetyActions calls the auth-protected sendSos server fn (src/lib/sos.functions.ts), which saves the emergency complaint first and then sends a best-effort WhatsApp alert via the Twilio connector gateway — WhatsApp failures must never block the saved alert. Recipient/sender come from optional SOS_WHATSAPP_TO / TWILIO_WHATSAPP_FROM secrets (sandbox sender by default).
- Native apps are a Capacitor shell (capacitor.config.ts) loading the live domain, with mobile-shell/ as offline fallback — web updates reach phones without store resubmission; native plugins must be guarded so the website works without them.
- Sticky page headers and the fixed-height booking layout consume the shared CSS safe-area inset — keeps controls below native status bars without adding spacing to ordinary browser views.
