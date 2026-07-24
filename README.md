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
cp .env.example .env      # values are prefilled for bus-tracker-capstone

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
  pages/         LoginPage · OverviewPage · (Phase 2 pages)
  config/        navigation.ts (sidebar structure)
```

**Rule:** components never import the Firebase SDK directly — they call a
`src/services/*` service (mirroring the mobile app's service pattern).

### Services (one per collection)

`auth` · `dashboard` · `agencies` · `admins` · `routes` · `stops` · `buses` ·
`schedules` · `issues` · `notifications` · `live`

Each returns typed data and wraps multi-document writes in `writeBatch` where
appropriate (e.g. `routes.createWithStops`, `routes.remove`). Mutating actions
should record an `adminUpdates` audit entry via `lib/firestore.logAdminUpdate`.

## Roles & access

- Access is gated by the `admins/{uid}` document — **exactly** as the mobile app:
  the doc must exist, `active === true`, and `role === 'admin'`.
- **Super Admin** is the additive, non-breaking strategy from the handoff: keep
  `role: 'admin'` and add `superAdmin: true`. The mobile gate still passes; the
  dashboard unlocks super-only features (admin management) on `superAdmin === true`.
- `agencyId` on an admin doc is the foundation for a future scoped "company
  admin" tier (queries and rules are structured to adopt it later).

### Creating the first super admin

Client writes to `admins` are denied until the [proposed rules](docs/PROPOSED_FIRESTORE_RULES.md)
are deployed, and even then a super admin must exist to bootstrap. Create the
first one out-of-band:

1. **Firebase Console → Authentication** → add a user (email/password).
2. **Firestore → `admins` collection** → add a document with **ID = that user's
   uid** and fields:
   ```json
   { "email": "you@example.com", "active": true, "role": "admin", "superAdmin": true }
   ```
3. Sign in to the dashboard with those credentials.

## Firestore rules

Two super-admin features (managing the `admins` registry, and `schedules`)
required additive rule changes. **These are applied and deployed as of
2026-07-24** — `isSuperAdmin()` was added, `schedules` got a public-read /
admin-write block, and `admins` writes moved from `if false` to `if isSuperAdmin()`.
Both features work against the live backend now.

The rules live in the mobile repo (`bus-tracker/firestore.rules`) because they are
shared project-wide; deploy any future change from there with
`firebase deploy --only firestore:rules`. Design rationale and the safety notes
are in [`docs/PROPOSED_FIRESTORE_RULES.md`](docs/PROPOSED_FIRESTORE_RULES.md).

## What NOT to change

Anything shared with the mobile app: collection names, document-ID schemes, field
names/types/enums, the `admins` gate semantics (`active` + `role`), and the
epoch-ms timestamp convention. Never ship a service-account key to the browser.
Full list in the handoff doc, §10.
