# Thrive While You Drive

An early-stage mobile-first driving exploration application.

## Local setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Enter the **new Thrive Supabase project's** `sb_publishable_` key as `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The project URL is already supplied in the example.
5. The initial SQL migration has been applied to the **Thrive** project (`nnpehyhqomhbznvjwtsl`). Do **not** re-run it against the live project. Use migrations for future changes.
6. Optionally set `VITE_MAP_STYLE_URL` to a licensed MapLibre-compatible style URL.
7. Run `npm run dev`.

For deployment, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the hosting provider's environment variable settings. **Never** add secret keys or database passwords to `VITE_` variables. `.env.local` is ignored by Git.

## Checks

Run `npm run typecheck`, `npm run build`, and `npm run test`.

## Status

This first milestone contains a responsive application shell, initial drive planner, optional map rendering, sign-in/up forms, profiles and tags. **Live route generation, location search, traffic estimates, GPS recording and turn-by-turn guidance are not implemented.** The route-generation button is intentionally disabled.

See [roadmap](docs/ROADMAP.md).
