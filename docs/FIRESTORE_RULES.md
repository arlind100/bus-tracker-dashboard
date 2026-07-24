# Firestore Security Rules — design record

> **Source of truth:** [`../../bus-tracker/firestore.rules`](../../bus-tracker/firestore.rules).
> The rules are shared by the whole `bus-tracker-capstone` project, so they are
> edited in the mobile repo and deployed from there:
>
> ```bash
> cd bus-tracker
> firebase deploy --only firestore:rules
> npm run verify:rules      # live allow/deny check, see below
> ```
>
> **Status: deployed and verified.** `npm run verify:rules` runs 37 assertions
> against the live backend as a temporary super admin, an agency-scoped admin,
> a signed-in passenger and an anonymous visitor — all pass.

## Tiers

| Tier | Identity signal |
|------|-----------------|
| Public | no auth — read-only access to published transit data |
| Signed-in passenger | any Firebase Auth user; owns `users/{uid}` |
| Admin | `admins/{uid}` exists **and** `active == true` **and** `role == 'admin'` |
| Agency admin | an admin whose record also carries `agencyId` |
| Super admin | an admin whose record also carries `superAdmin: true` |

The `active` + `role` pair is checked **verbatim** by the mobile app, the
dashboard and the rules. Never rename or repurpose them. The super tier stays
additive (`role` remains `'admin'`) so the mobile gate keeps working unchanged.

## Permission matrix (deployed)

| Collection | Read | Create / Update | Delete |
|------------|------|-----------------|--------|
| `routes` | everyone | admin, own agency only if scoped | admin, own agency only if scoped |
| `stops` | everyone | admin | admin |
| `buses` | everyone | admin, own agency only if scoped | admin, own agency only if scoped |
| `busLocations` | everyone | admin | admin |
| `schedules` | everyone | admin | admin |
| `agencies` | everyone | create: **super admin**; update: super admin, or the scoped admin's own agency | **super admin** |
| `notifications` | everyone | admin | admin |
| `drivers` (PII) | **admin only**, own agency if scoped | admin, own agency only if scoped | admin, own agency only if scoped |
| `issueReports` | admin | create: **anyone** (a signed-in reporter may only attribute it to themselves); update/delete: admin | admin |
| `users/{uid}` | owner | owner, and `role` may only be `'passenger'` | owner |
| `admins/{uid}` | any signed-in user | **super admin**, `role` must stay `'admin'` | **super admin**, never themselves |
| `adminUpdates` | admin | create only, `adminUid` must equal the caller | **nobody** (append-only) |

## The non-obvious guarantees

- **Privilege escalation is impossible from a client.** A passenger cannot write
  `admins/{uid}`, and cannot claim `role: 'admin'` in their own `users` profile.
  An agency admin cannot set `superAdmin` on themselves.
- **Lock-out is impossible.** A super admin cannot deactivate themselves, clear
  their own super flag, or delete their own admin record — otherwise the registry
  could be left with no one able to manage it.
- **Audit attribution cannot be spoofed.** `createdBy`/`updatedBy`, when present,
  must equal the caller's uid (an existing `createdBy` may be preserved on
  update). `adminUpdates` entries must carry the caller's own `adminUid` and are
  immutable once written.
- **Driver PII never reaches passengers.** `drivers` is admin-only for read; the
  passenger app renders the denormalized `buses.driver` **name** instead.
- **Agency scoping is enforced on both sides of a write.** A scoped admin cannot
  create a document in another agency, nor move one of their own into another.

## Client contract implied by the rules

An agency-scoped admin must **query `drivers` with an `agencyId` filter**. A list
query that could return another agency's document is rejected in full, so
`driversService.list(scopeAgencyId)` passes the caller's agency (see
`src/services/drivers.service.ts`). Global/super admins pass nothing and read the
whole collection.

## Bootstrapping

The first super admin cannot be created by any client (that is the point). Use
the Admin-SDK script in the mobile repo:

```bash
cd bus-tracker
npm run bootstrap:superadmin -- --email you@example.com
```

After that, every further admin is managed from the dashboard's Admins page.
