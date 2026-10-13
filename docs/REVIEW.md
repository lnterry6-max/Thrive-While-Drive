# Foundation review — October 13, 2026

Reviewed source from `feature/initial-foundation` at `41f4841`.
The downloaded workspace had no Git metadata. Restored history from
`https://github.com/lnterry6-max/Thrive-While-Drive` and created `development`
from that feature branch (the remote had only `main` and the feature branch).

## Findings fixed

- Typechecking failed with four `ImportMeta.env` errors. Added Vite client types
  and included Vite/Vitest configuration in typechecking.
- Initial installation reported nine dependency vulnerabilities. Updated Vite,
  its React plugin, Vitest, MapLibre and React Router; pinned Supabase and added
  a lockfile. Node.js 24 is now the documented and CI runtime. Adapted MapLibre's
  import to its current named exports.
- Profile tags were never fetched. Profiles now load before editing is enabled.
- An UPDATE affecting zero rows could be reported as successful. Saving now
  requires a returned row and updates `updated_at`.
- Session restoration could race with auth events, and account changes could
  retain stale profile state. Responses are now scoped to the current account
  and component lifecycle; subscriptions are cleaned up.
- Auth, profile and sign-out failures now surface in the UI. Forms validate
  inputs and pending actions are disabled.
- Missing or invalid Supabase environment values no longer crash public pages.
  Only `sb_publishable_` keys are accepted by the browser configuration.
- Map initialization/provider failures display a fallback instead of crashing
  the application. The existing layout and planner remain; no GPS or routing
  implementation was added.

## Verification

- PASS: clean `npm ci` from the committed lockfile, using Node 24.21.0.
- PASS: `npm run typecheck`.
- PASS: `npm test` — 23 tests across three files. Supabase and WebGL are mocked.
- PASS: `npm run build`.
- PASS: final `npm audit` — zero reported vulnerabilities.
- PASS: browser smoke check of Home, planner changes and Profile initialization;
  no captured browser warnings/errors. Route generation remains disabled.
- PASS: GitHub Actions workflow added for installation, typechecking, tests and
  production build on pushes and pull requests. Hosted execution is pending push.

Live Supabase checks on `nnpehyhqomhbznvjwtsl`:

- Auth settings endpoint returned HTTP 200 with the project's publishable key.
  Email auth and signup are enabled; email confirmation is required.
- Anonymous REST reads of profiles and drive preferences returned HTTP 200 and
  zero rows. No user data was printed.
- Catalog inspection confirmed RLS on both tables, ownership predicates on
  SELECT/INSERT/UPDATE, and both USING and WITH CHECK for UPDATE.
- The signup trigger is installed and its function inserts both the profile and
  preferences. Its search path is empty and direct execution is revoked from
  PUBLIC, anon and authenticated.
- Supabase security advisor returned no findings.
- The live project still has broad default table grants; RLS restricts ordinary
  Data API access. No live schema or authorization settings were changed.

The project's publishable key is stored only in ignored `.env.local`. No secret
key or password was used. CI needs no Supabase credentials. The initial migration
was not reapplied and no real users were created or modified.

## Failures and remaining manual checks

The initial typecheck and dependency audit failed and are fixed. An intermediate
package upgrade hit npm's stale peer resolution; a clean dependency resolution
fixed it without `--force` or `--legacy-peer-deps`. Network and local-server
sandbox restrictions were resolved through approved escalation. No final local
check is failing. npm still prints a transitive `whatwg-encoding` deprecation
warning; it does not affect the checks.

A controlled test account/inbox is still needed to verify email delivery and
confirmation redirects, successful live login, refresh/session expiry, tag
persistence and cross-account isolation end to end. Mocked tests and catalog
checks do not establish those live outcomes. Also verify real licensed map
styles/WebGL, physical mobile devices, deployed SPA deep links and the first
hosted GitHub Actions run. See the README checklist.

## Documentation consulted

- [Supabase auth state subscription](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase Data API grant changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Supabase TLS compatibility notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
