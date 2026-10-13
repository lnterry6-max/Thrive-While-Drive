# Thrive While You Drive

An early-stage mobile-first driving exploration application.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Enter the **new Thrive Supabase project** URL and publishable/anon key. Never use AutoType credentials.
5. Review and apply `supabase/migrations/202610130001_initial_foundation.sql` in the new project.
6. Optionally set `VITE_MAP_STYLE_URL` to a licensed MapLibre-compatible style URL.
7. Run `npm run dev`.

## Checks

Run `npm run typecheck`, `npm run build`, and `npm run test`.

## Status

This first milestone contains a responsive application shell, initial drive planner, optional map rendering, sign-in/up forms, profiles and tags. **Live route generation, location search, traffic estimates, GPS recording and turn-by-turn guidance are not implemented.** The route-generation button is intentionally disabled.

See [roadmap](docs/ROADMAP.md).
