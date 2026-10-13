# Version 0.2 review — October 13, 2026

## Delivered

Preserved foundation commit `f120dce`, published `development`, and opened [draft PR #2](https://github.com/lnterry6-max/Thrive-While-Drive/pull/2) against `main`. The foundation CI run passed before the v0.2 work. No merge or app deployment is authorized or performed.

The application now has a consistent forest/evergreen/sage/cream design across Home, Explore, Community, Statistics, Profile, Settings, recovery and credits. One authentic, licensed David Moum road photograph is served locally in optimized responsive WebP sizes, with attribution. Empty states honestly describe unavailable statistics, routes, achievements and friends. No GPS, routing engine, payments or AI imagery was added.

Account features include registration/login, verification resend, password recovery, email/password changes, sign-out everywhere, case-insensitive usernames, names, bios, five-interest limit, profile images/banners, visibility, preferences and deletion. Errors, retries, loading states and session changes are handled explicitly. Image processing checks type/signature/size/dimensions, re-encodes and removes metadata; writes require a returned profile row. Cleanup preserves the old photo until replacement saves and aborts on errors or nonprogress.

## Main files changed

| Area                       | Files                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell, navigation, design  | `src/App.tsx`, `src/styles.css`, `src/main.tsx`, `index.html`                                                                                                                              |
| Authentication             | `src/auth/AuthProvider.tsx`, `src/pages/AuthForm.tsx`, `src/pages/ResetPassword.tsx`                                                                                                       |
| Profile/account            | `src/Profile.tsx`, `src/pages/Settings.tsx`, `src/lib/profile.ts`, `src/lib/useProfile.ts`                                                                                                 |
| Supabase/media             | `src/lib/supabase.ts`, `src/lib/database.types.ts`, `src/lib/media.ts`, `src/components/ProfileImage.tsx`                                                                                  |
| Pages/shared UI            | `src/pages/Home.tsx`, `Explore.tsx`, `Community.tsx`, `Statistics.tsx` (credits are in `App.tsx`); `src/components/ScenicPhoto.tsx`, `ProfileView.tsx`, `MapPreview.tsx`, `EmptyState.tsx` |
| Photography                | `public/images/scenic-road-{800,1600}.webp`, `docs/IMAGE-LICENSES.md`                                                                                                                      |
| Verification               | component/media tests, `tests/database.test.ts`, `src/test/`, `vitest.config.ts`, `tsconfig.json`                                                                                          |
| Dependencies/documentation | `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `docs/ROADMAP.md`                                                                                                          |

The existing `.github/workflows/ci.yml` runs clean installation, typechecking, all tests and a production build on pushes and pull requests with Node 24.

## Database migration

The user approved the reviewed `20261013204848_account_profiles_v02.sql` migration. It was applied successfully to **nnpehyhqomhbznvjwtsl**. Supabase recorded version `20261013210310`; the local filename was reconciled to `20261013210310_account_profiles_v02.sql` without changing the approved SQL. The unchanged foundation migration was likewise renamed to match its already-applied remote version `20261013201644`.

The migration adds bio, avatar/banner paths and default-private visibility, constraints, restricted column grants, public-profile reads, timestamp triggers, private `profile-media` storage and caller-only account deletion. The deletion wrapper is SECURITY INVOKER; its narrowly scoped private definer uses an empty search path and requires the caller's fresh Auth session. There is no caller-supplied account ID. The function was created, not invoked against a real account.

Live checks confirmed the existing one profile and one preferences record survived, the profile stayed private, and the private bucket enforces a 5 MB WebP limit. Read-only transactional role/JWT simulations confirmed owner reads, no other-account private reads and no anonymous private reads. They did not create real test users. AutoType was not accessed or changed.

## Verification results and boundaries

- PASS: clean `npm ci`, TypeScript checks, production build and `git diff --check`.
- PASS: final `npm audit` reports zero vulnerabilities. Installation retains a nonblocking transitive `whatwg-encoding` deprecation warning and an optional macOS `fsevents` install-script notice.
- The first sandboxed clean install failed with registry DNS restrictions; approved registry access resolved it. No final local check is failing.

- Local automated suite: **74 tests across six files**, including **15 PostgreSQL policy/migration tests**. Component tests exercise auth failures/recovery routing, profile writes and races, tags, settings/deletion confirmations, map lifecycle and upload restrictions/cleanup.
- PostgreSQL tests apply both actual migrations to PGlite, substituting local Auth/Storage schemas and roles and omitting the pgcrypto extension declaration (UUID generation is available). They cover case-insensitive uniqueness, owner isolation, column restrictions, public/private reads, media paths, fresh-session deletion and cascades. These are not full live Supabase Auth/Storage service tests.
- Axe checks cover Home, Explore, Community, Profile and Settings with no reported enabled-rule violations. Color contrast is excluded in jsdom; a screen-reader and physical-device audit remains necessary.
- Browser review observed restoration of an existing signed-in session and a successful live profile read. Profile editor opened/cancelled without changing the record. No live signup, password change, email delivery, media upload or account deletion was performed.
- Responsive checks cover desktop 1440 px and mobile 390/320 px, navigation, empty states, planner and account screens. No broken scenic images or horizontal overflow observed. Fresh browser console captured no errors/warnings after fixing the React image-prop warning.

## Security findings

- Publishable configuration comes from environment variables; `.env.local` and Supabase temporary files are ignored. No service-role key or database password is used or committed.
- Profile/preferences ownership remains enforced by RLS. IDs/timestamps and direct insert/delete privileges are restricted. Preferences and email are not part of public profile data.
- Storage is private, immutable generated paths belong to the caller, and public reads require a current public-profile reference. Clearing a public profile cannot recall previously downloaded images.
- Deletion is restricted to the authenticated caller with a recent session, and refuses to orphan stored photos. Storage cleanup can finish before a later deletion failure; retry is required in that case.
- Supabase advisor reports **leaked-password protection disabled**. Review and enable the project setting where supported: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No other advisor security findings were returned after the migration. This updates the historical foundation review's earlier zero-finding snapshot.

## Manual release checklist

1. With controlled inboxes/accounts, exercise signup, confirmation/resend, login/logout, reload, expired sessions, offline failures, reset links (valid/expired/reused) and email changes. Verify Site URL, redirect allowlists, SMTP and rate limiting.
2. Save all profile fields and five tags, reload, collide differently cased usernames, and switch between two real accounts. Verify private/public `/people/:username` behavior including underscores.
3. Upload real JPEG/PNG/WebP files on desktop and mobile. Verify crop/orientation, metadata removal, replacement, removal, oversize/malformed rejection and private/public image reads with two real sessions and anonymous requests. Local mocks do not establish live Storage success.
4. Delete a deliberately disposable account with uploaded images. Confirm cleanup, fresh-session enforcement, Auth/profile/preferences removal and old-session isolation. Do not test deletion on the existing user's account.
5. Test keyboard focus, zoom, screen readers, touch targets and color contrast on actual devices; test licensed map tiles and WebGL once configured. Routing must stay disabled.
6. Before any separately authorized deployment, configure SPA fallback and test direct recovery/profile/settings URLs on the chosen host. No app has been deployed by this work.

Next development should close this checklist first, then address licensed geocoding/map integration and privacy-aware route planning in a separate milestone.
