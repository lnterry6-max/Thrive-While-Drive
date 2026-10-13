# Thrive While You Drive

An early-stage mobile-first driving exploration application.

## Local setup

1. Install Node.js 24 (`nvm use` if you use nvm).
2. Run `npm ci` (uses the committed lockfile).
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


## Automated verification

GitHub Actions runs `npm ci`, typechecking, the Vitest/Testing Library suite,
and the production build on every push and pull request, using Node.js 24.
No Supabase credentials are needed in CI: auth/database calls and WebGL are mocked.
Tests cover session restoration and account changes, signup/sign-in failures,
profile loading and saving, the five-tag limit, sign-out, configuration failures,
map failures, and the existing planner and placeholder pages.

The browser client accepts only a publishable key. Missing/invalid configuration
leaves public pages available and disables authentication. Set the variables
before building; Vite embeds public configuration into the client bundle.
Never use a service-role key, secret API key, or database password here.

## Manual release checks

- With an inbox you control, create an account, confirm the email, sign in,
  refresh, and sign out. Verify Supabase Site URL and allowed redirect URLs
  match the local/deployed application.
- Save profile tags, reload, and verify they persist. Switch between two accounts
  and confirm each sees only its own tags. Exercise expired sessions and offline
  requests; check that failures never report a successful save.
- With a licensed `VITE_MAP_STYLE_URL`, check map tiles, controls, attribution,
  and WebGL behavior on desktop and mobile devices.
- Check mobile layout and keyboard interactions, and configure the host to serve
  `index.html` for SPA routes such as `/profile` and `/explore`.
- Confirm the first GitHub Actions run passes after the commit is pushed.

See [review results](docs/REVIEW.md) for this review's verification boundaries.
