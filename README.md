# Bus Tracker — Super Admin Dashboard

A production-grade web dashboard for operating the **Bus Tracker** platform. It
connects to the **same Firebase backend** (`bus-tracker-capstone`) as the Bus
Tracker mobile app and is a management surface on top of it — not a replacement
backend. Collection names, document shapes, field names, enum values, and the
epoch-ms timestamp convention all mirror the mobile app exactly.

> The mobile app is the source of truth and is **never** modified by this
> project. See [`../SUPER_ADMIN_FIREBASE_HANDOFF.md`](../SUPER_ADMIN_FIREBASE_HANDOFF.md)
> for the full backend analysis.

## Tech stack

- **React 19** + **TypeScript** (strict) + **Vite**
- **Tailwind CSS v4** — Anthropic/Claude-inspired deep-blue theme, light + dark
- **Firebase modular SDK v12** — Firestore + Auth (email/password)
- **React Router 7**, **TanStack Query 5**, **React Hook Form** + **Zod**
- **lucide-react** icons, **sonner** toasts

## Getting started

```bash
# 1. Install (already done in this workspace)
npm install

# 2. Configure Firebase (public client identifiers — not secrets)
cp .env.example .env      # project/auth/bucket/sender are prefilled for
                          # bus-tracker-capstone; fill in API key + app id from
                          # Firebase Console -> Project settings -> Your apps

# 3. Run
npm run dev               # http://localhost:5173

# 4. Build / preview
npm run build
npm run preview
```

> **Never hard-code the Firebase config.** It is read from `VITE_FIREBASE_*` at
> build time (`src/firebase/config.ts`). `.env` is git-ignored; only
> `.env.example`, which holds placeholders, is tracked.

## Architecture

```
src/
  firebase/      config.ts (env-based init) · collections.ts (verbatim from mobile)
  types/         canonical types mirroring Firestore document shapes
  lib/           utils (cn, formatters) · firestore (timeout, name-maps, audit log)
  services/      ONE file per collection — all Firebase logic lives here
  contexts/      Auth + Theme providers (own the Firebase subscriptions)
  hooks/         useAuth · useTheme
  components/    ProtectedRoute · PageHeader · StatCard · ui/* (shadcn-style)
  layouts/       DashboardLayout · Sidebar · Topbar
  pages/         LoginPage · OverviewPage · agencies · admins · routes · stops ·
                 buses · drivers · live · schedules · notifications · issues ·
                 analytics
  config/        navigation.ts (sidebar structure)
```

**Rule:** components never import the Firebase SDK directly — they call a
`src/services/*` service (mirroring the mobile app's service pattern).

### Services (one per collection)

`auth` · `dashboard` · `agencies` · `admins` · `routes` · `stops` · `buses` ·
`drivers` · `schedules` · `issues` · `notifications` · `live`

Each returns typed data and wraps multi-document writes in `writeBatch` where
appropriate (e.g. `routes.createWithStops`, `routes.remove`). Mutating actions
should record an `adminUpdates` audit entry via `lib/firestore.logAdminUpdate`.

## Roles & access

**Authentication proves who you are; `admins/{uid}` decides what you may do.**
Signing in grants nothing on its own. Access
requires an `admins/{uid}` document that exists, is `active`, and carries one of
two roles. `role` is the single source of truth; there is no second flag.

| `role` | Scope |
|---|---|
| `super_admin` | The whole platform. Manages agencies and the admins registry. Carries no `agencyId`. |
| `agency_admin` | Exactly one agency — **`agencyId` is mandatory**. Reads and writes only that agency's routes, stops, buses, drivers, schedules, checkpoints and alerts. |

Both the dashboard and `firestore.rules` apply the same gate, so bypassing the
UI and calling Firestore directly changes nothing. The rules additionally reject:
an `agency_admin` with no agency, a `super_admin` carrying one, an invented role,
an admin changing their own role or agency, and a super admin demoting or
deactivating themselves.

### Sign-in methods

**Email and password only.** There is no federated sign-in and no self sign-up:
every account is one a super admin created on the Administrators page, either by
having the dashboard create the Auth account or by linking an existing Firebase
Auth uid.

Sign-in funnels through `resolveUser()`, and an account with no active admin
record is signed straight back out — it is **never** provisioned an admin
document, a role or an agency.

### Provisioning an agency user

Administrators → **New administrator** → *Create new account*: the dashboard
creates the Firebase Auth account on an isolated secondary app (so your own
session is untouched), then writes the scoped `admins/{uid}` record. Choosing
*Agency administrator* makes the agency field mandatory.

### Creating the first super admin

Only a super admin can write the `admins` registry, so the first one must be
created out-of-band. From the mobile repo (it holds the Admin-SDK scripts):

```bash
cd ../bus-tracker
npm run bootstrap:superadmin -- --email you@example.com
```

The account must already exist in Firebase Authentication. After that, every
further administrator — including their Firebase Auth account — is created from
the dashboard's **Admins** page.

## Firestore rules

The rules are **deployed and verified**. They enforce four tiers (public,
signed-in passenger, `agency_admin`, `super_admin`), scope every agency-owned
collection — routes, stops, buses, schedules, checkpoints, alerts and drivers —
to its owning agency, protect driver PII, prevent privilege escalation and
self-lock-out, keep the admins registry unreadable to non-admins, make the audit
log append-only, and stop audit attribution (`createdBy` / `updatedBy`) from
being spoofed.

They live in the mobile repo (`bus-tracker/firestore.rules`) because they are
shared project-wide. Deploy and re-verify any change from there:

```bash
cd ../bus-tracker
firebase deploy --only firestore:rules
npm run verify:rules    # 62 live allow/deny assertions
```

The full matrix and rationale are in [`docs/FIRESTORE_RULES.md`](docs/FIRESTORE_RULES.md).

> **Client contract:** an agency-scoped admin must query `drivers` with an
> `agencyId` filter — an unfiltered list could return another agency's PII and is
> rejected wholesale. `driversService.list(scopeAgencyId)` handles this.

## Drivers ↔ buses

`drivers` replaces the free-text `buses.driver` string as the source of truth,
but **does not remove it**. Every assignment writes both sides in a `writeBatch`:

| Field | Purpose |
|-------|---------|
| `buses.driverId` | reference into `drivers` (dashboard truth) |
| `buses.driver` | the driver's NAME — what the mobile app renders. Never drop it. |

Renaming a driver refreshes the assigned bus's `driver` string, and deleting a
driver (or a bus) clears the other side, so the two can never disagree. Buses
created before this collection existed keep their legacy free-text name; the bus
form surfaces it as a hint rather than silently discarding it.

## What NOT to change

Anything shared with the mobile app: collection names, document-ID schemes, field
names/types/enums, the `admins` gate semantics (`active` + `role`), and the
epoch-ms timestamp convention. Never ship a service-account key to the browser.
Full list in the handoff doc, §10.

## Running both apps together

The dashboard writes and the passenger app reads the same Firestore project, so
run them side by side to see the whole chain:

```bash
# terminal 1 — dashboard        → http://localhost:5173
cd bus-tracker-dashboard && npm install && npm run dev

# terminal 2 — passenger app    → http://localhost:8081
cd bus-tracker && npm install && npm run web
```

`npm run web` pins port 8081 on purpose: that exact origin is what the passenger
app's Google OAuth web client must authorize, and Expo would otherwise drift to
the next free port. (The dashboard itself has no Google sign-in.) The only
scripts this project defines are `dev`, `build`, `lint` and `preview`.

Quality gates:

```bash
npm run lint      # ESLint
npx tsc -b        # TypeScript
npm run build     # production build
```

The Firestore rules and the two verification scripts live in the mobile repo
(they are shared project-wide) — see `../bus-tracker/README.md`.

## Deployment status

**Complete, no console work needed:** email/password login, the `admins/{uid}`
gate, super-admin and agency-scoped tiers, the route guard, session persistence,
full CRUD for agencies/routes/stops/buses/drivers/schedules/notifications,
issue triage, live checkpoints, the audit log, empty states on every page, and
the production build.

**Requires you:** nothing for the dashboard itself. Deploying it to a real domain
needs that domain added under Firebase Console → Authentication → Settings →
**Authorized domains** (localhost already works). Google sign-in is mobile-only
— see `../bus-tracker/README.md` → *Deployment status*.
