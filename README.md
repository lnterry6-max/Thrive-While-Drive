# Thrive While You Drive

Version 0.2 is a mobile-first scenic driving planner and account experience built with React, TypeScript, Vite and Supabase. Real navigation, GPS recording and route publishing are future work; the planner clearly labels those limits.

## Local setup

1. Use Node.js 24 (`nvm use`).
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_PUBLISHABLE_KEY` to the Thrive project's `sb_publishable_` key. The example includes the URL for project `nnpehyhqomhbznvjwtsl`.
4. Optionally supply a licensed MapLibre-compatible `VITE_MAP_STYLE_URL`. Without it, the planner shows an intentional map placeholder.
5. Run `npm run dev`.

Only publishable configuration belongs in `VITE_` variables: Vite embeds them in browser bundles. Never put a service-role key, secret key or database password there. `.env.local` is ignored; do not commit credentials. Missing configuration leaves public pages available and explains why sign-in is unavailable.

## Account features

Email signup, verification/resend, login, recovery, password/email changes, global sign-out, case-insensitive unique usernames, editable display names and biographies, up to five interests, private/public profiles, avatar/banner uploads, saved drive preferences and self-service deletion are implemented. Public profiles live at `/people/:username`; a username is needed to share a profile link.

Uploads accept JPEG, PNG and WebP up to 5 MB, validate signatures, decode and resize, then re-encode as WebP to remove source metadata. Storage is private. Public image access is limited to images currently referenced by a public profile. Previously downloaded copies cannot be recalled.

Account deletion requires typing DELETE and password reauthentication. Storage objects are removed through the Storage API before a caller-only database function deletes Auth/profile/preferences records. The database independently requires a session created within five minutes and refuses deletion while owned images remain. Cleanup and account deletion are not a single transaction: if a later step fails, the account can remain with photos already removed. The UI reports failures so users can retry.

## Database

Both migrations have been applied to **Thrive only**, with existing records preserved:

- `20261013201644_initial_foundation.sql`
- `20261013210310_account_profiles_v02.sql`

Local filenames match remote migration history. Do not reapply them manually to the live project. Review future migrations before applying them. The v0.2 migration adds profile fields, restricted column grants, public-profile read policies, private image storage policies, timestamp triggers and caller-only account deletion. Generated types are in `src/lib/database.types.ts`.

## Verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm audit
```

GitHub Actions performs installation, typechecking, tests and production builds on pushes and pull requests with Node 24. No credentials are required in CI. Component tests mock Supabase and WebGL; database tests run the actual migrations in local PGlite with lightweight Auth/Storage fixtures. They do not run a complete Supabase service or send email. Axe checks cover structural accessibility; automated color-contrast checks are disabled in jsdom.

See [v0.2 review and manual checklist](docs/VERSION-0.2-REVIEW.md), [original foundation review](docs/REVIEW.md), [roadmap](docs/ROADMAP.md) and [photography licenses](docs/IMAGE-LICENSES.md).

## Before a release

Configure Supabase Site URL and redirect allowlists for the exact intended origins and `/profile`, `/settings`, `/reset-password` paths. Email confirmation must remain enabled. Check SMTP delivery/rate limits and enable leaked-password protection if available for the project. Verify recovery, verification and email-change links with inboxes you control.

Run the controlled two-account and Storage checks in the review document. Configure the hosting server to serve `index.html` for SPA deep links. No app deployment or merge is performed by this change.
