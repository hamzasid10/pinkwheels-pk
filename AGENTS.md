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
- Driver live location lives in driver_locations (RLS: own write while online+consented, assigned rider/admin read); public nearby view only via the nearby_drivers() RPC returning rounded coords.
