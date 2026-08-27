# Bus Tracker Admin Dashboard

A web dashboard for operating the Bus Tracker platform. It connects to the same
Firebase project as the [Bus Tracker mobile app](../bus-tracker) and is the
management surface on top of it: everything an operator publishes here is what
passengers see in the app.

## Functionality

- **Overview** — fleet, route and issue statistics with charts.
- **Agencies** — create and manage transport operators, with a detail page per
  agency.
- **Administrators** — create dashboard accounts and assign roles. Two roles:
  `super_admin` (whole platform) and `agency_admin` (scoped to one agency).
- **Routes and stops** — full CRUD, including per-route ordered stops.
- **Buses and drivers** — fleet registry and driver records, with bus/driver
  assignment written atomically on both sides.
- **Schedules** — departure and arrival timetable rows per route.
- **Live operations** — live map of reporting buses, manual checkpoint entry,
  and a manual-control hold that stops a bus from being moved automatically.
- **Notifications** — broadcast service alerts to passengers.
- **Issues** — triage the problem reports submitted from the mobile app.
- **Audit log** — mutating actions are recorded to `adminUpdates`.

Access is enforced twice: by the dashboard and by the Firestore security rules.
Signing in proves identity only — authority comes from an active `admins/{uid}`
record. Sign-in is email and password; there is no self sign-up.

## Tech stack

- **React 19** + **TypeScript** (strict) + **Vite**
- **Tailwind CSS v4** with Radix UI primitives (shadcn-style components)
- **Firebase Web SDK v12** — Firestore and Authentication
- **React Router 7** — routing and route guards
- **TanStack Query 5** — server state and caching
- **React Hook Form** + **Zod** — forms and validation
- **React Leaflet** + **Leaflet** — the live operations map
- **Recharts** — charts
- **lucide-react** icons, **sonner** toasts, **date-fns**
- **ESLint** + **typescript-eslint**

## Requirements

- Node.js 18 or newer
- npm
- A Firebase project with Firestore and Authentication (email/password) enabled
- At least one super admin account (bootstrapped from the mobile repo with
  `npm run bootstrap:superadmin`)

## Environment setup

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

Variables:

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender id |
| `VITE_FIREBASE_APP_ID` | Firebase web app id |

These are public client identifiers; access is controlled by the Firestore
security rules, not by keeping them secret. They must point at the same Firebase
project as the mobile app. `.env` is git-ignored — never commit it, and never
put a service-account key here.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The dev server runs at http://localhost:5173.

## Production build

```bash
npm run build
```

Preview the built output locally:

```bash
npm run preview
```

## Other scripts

```bash
npm run lint     # ESLint
npx tsc -b       # TypeScript
```

## Project structure

```
src/
  firebase/     Firebase initialization and collection-name constants
  types/        domain types mirroring the Firestore document shapes
  lib/          utilities, Firestore helpers, audit log
  services/     one file per collection - all Firebase access lives here
  contexts/     auth provider
  hooks/        auth, agency scoping, data tables
  components/   shared UI and shadcn-style primitives
  layouts/      dashboard shell, sidebar, topbar
  pages/        one folder per section
  config/       sidebar navigation
```

Components never import the Firebase SDK directly — they call a service in
`src/services/`.

## Firestore rules

The security rules are shared across the project and live in the mobile repo at
`../bus-tracker/firestore.rules`. Deploy and verify them from there:

```bash
cd ../bus-tracker
firebase deploy --only firestore:rules
npm run verify:rules
```

The permission matrix and the reasoning behind it are documented in
[`docs/FIRESTORE_RULES.md`](docs/FIRESTORE_RULES.md).
