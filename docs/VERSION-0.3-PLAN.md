# Version 0.3 — Real Maps and Route Planning (first beta milestone)

## Implemented in this branch

- MapLibre displays real OpenFreeMap / OpenStreetMap vector road maps with attribution. No map API key required.
- Location search uses GraphHopper Geocoding through an authenticated, server-side Vercel API. A user must select a result rather than sending unverified place text to the route planner.
- Optional browser current-location use requests permission only when clicked. No GPS recording or saved home locations.
- Point-to-point driving routes with optional via-town, and discovery loops anchored at the start or a chosen exploration area. Loops may include outbound and return legs; estimated exploration versus transit minutes are shown separately.
- When configured, GraphHopper returns real route geometry, approximate distance and time; MapLibre displays route lines and zooms to their bounds.
- The GraphHopper key stays in a server-only `GRAPH_HOPPER_API_KEY` variable, never a `VITE_` variable. The server checks Supabase bearer tokens before sending third-party requests.

## Enabling location search and route generation

1. Get a GraphHopper Directions API key from https://www.graphhopper.com/.
2. Set `GRAPH_HOPPER_API_KEY` in **Vercel → Project Settings → Environment Variables → Preview**, not in the public frontend. Never paste the key into this chat or commit it.
3. Redeploy this feature branch after saving the variable, and verify `/api/planner?action=status` returns `{"maps":true,"routing":true}`.
4. Sign in and test geocoding, one-way routing, one discovery loop, loops with transit legs, and the optional motorway restriction using real provider responses. Live GraphHopper contract checks remain pending until credentials are configured.

Default map style: `https://tiles.openfreemap.org/styles/liberty`; optional override with `VITE_MAP_STYLE_URL`. Preserve OSM attribution.

## Safety, privacy and provider limitations

- **Park before planning.** This is a route preview, not in-motion navigation or live turn-by-turn guidance. No GPS tracking or background location collection is implemented.
- A requested time target is converted into an *approximate distance* for loops; reported ETAs are estimates without live traffic.
- The requested avoid-highways option is sent as a provider custom model for motorway/trunk-road exclusion; if that fails, the API reports an error instead of silently dropping the restriction. Real-provider testing is required before relying on it.
- Traffic avoidance, intersection complexity and scenic/relaxing style preferences do not yet affect route scoring and are explicitly labeled unsupported in the UI.
- Chosen coordinates are transmitted to the provider for geocoding/routing only after user action, and not persisted in Supabase.
- Provider requests are restricted to signed-in users. Before broad public access, add durable abuse prevention/rate limits, provider quota monitoring and billing caps. Never commit the provider key.
- Reuse licensed, real photography only. The map is real geographic data, not generated imagery.

## Release checklist

- All existing and new tests, TypeScript and production build pass on GitHub Actions.
- Confirm MapLibre renders in Safari/Chrome and iPhone Safari; verify accessible zoom and attribution.
- Confirm `/api/planner?action=status` responds with JSON, not the SPA's HTML, even with Vercel rewrites.
- Verify real signed-in geocoding and routes only after setting provider credentials. Check no-key, wrong token, provider failure, and invalid location behavior.
- Verify no private location history is stored or shared; only the Thrive backend is used.
- Do **not** merge this branch or launch as public navigation until live provider, privacy, safety and mobile-device checks are complete.

References: https://openfreemap.org/quick_start/ · https://docs.graphhopper.com/openapi/section/explore-our-apis/api-explorer · https://vercel.com/docs/functions/runtimes/node-js
