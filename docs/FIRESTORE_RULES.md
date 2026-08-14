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
> **Status: deployed and verified.** `npm run verify:rules` runs 62 assertions
> against the live backend as a temporary super admin, an agency admin, a
> deactivated admin, a signed-in passenger and an anonymous visitor — all pass.

## Tiers

| Tier | Identity signal |
|------|-----------------|
| Public | no auth — read-only access to published transit data |
| Signed-in passenger | any Firebase Auth user (password or Google); owns `users/{uid}` |
| Agency admin | `admins/{uid}` with `active == true` and `role == 'agency_admin'` **and** a non-empty `agencyId` |
| Super admin | `admins/{uid}` with `active == true` and `role == 'super_admin'` (never carries an `agencyId`) |

`role` is the **single** source of truth for the tier — there is no separate
boolean flag to keep in sync — and `active` is the kill switch. Both are read
verbatim by the dashboard and by the rules; never rename or repurpose them.

**Authentication grants nothing.** Signing in proves identity; only an active
`admins/{uid}` record grants authority. A Firebase Auth user without one — which
is what any new Google account is — is a passenger.

## Permission matrix (deployed)

| Collection | Read | Create / Update | Delete |
|------------|------|-----------------|--------|
"Own agency" below means: a super admin may write anything; an agency admin may
write only documents whose `agencyId` equals theirs, checked on **both** the
existing and the incoming document so a record can neither be stolen from nor
pushed into another agency.

| Collection | Read | Create / Update | Delete |
|------------|------|-----------------|--------|
| `routes` | everyone | admin, own agency | admin, own agency |
| `stops` | everyone | admin, own agency | admin, own agency |
| `buses` | everyone | admin, own agency | admin, own agency |
| `busLocations` | everyone | admin, own agency | admin, own agency |
| `schedules` | everyone | admin, own agency | admin, own agency |
| `notifications` | everyone | admin, own agency | admin, own agency |
| `agencies` | everyone | create: **super admin**; update: super admin, or the agency admin's own agency | **super admin** |
| `drivers` (PII) | **admin only**, own agency | admin, own agency | admin, own agency |
| `issueReports` | admin | create: **anyone** (a signed-in reporter may only attribute it to themselves); update/delete: admin | admin |
| `users/{uid}` | owner | owner, and `role` may only be `'passenger'` | owner |
| `admins/{uid}` | **own record, or any admin** | **super admin** only, and the document must be well-formed (see below) | **super admin**, never themselves |
| `adminUpdates` | admin | create only, `adminUid` must equal the caller | **nobody** (append-only) |

`stops`, `schedules`, `busLocations` and `notifications` carry an `agencyId`
denormalized from the route or bus that owns them, written by the dashboard. That
is what makes them scopeable without an extra document read on every write.

## The non-obvious guarantees

- **Privilege escalation is impossible from a client.** A passenger cannot write
  `admins/{uid}`, and cannot claim a privileged `role` in their own `users`
  profile. An agency admin cannot change their own `role` to `super_admin`, nor
  move themselves to another `agencyId`.
- **The tier boundary survives a hand-crafted request.** Even a super admin
  cannot write a malformed record: `role` must be one of the two real tiers, an
  `agency_admin` must carry a non-empty `agencyId`, and a `super_admin` must
  carry none. That closes the hole where a scoped admin created without an
  agency would silently have acted globally.
- **The registry is not public.** `admins` is readable only by its own subject
  and by admins, so a signed-in passenger cannot enumerate administrator emails
  and agency assignments.
- **Deactivation is immediate.** `active: false` fails every gate, so revoking
  access needs no Auth-account deletion.
- **Lock-out is impossible.** A super admin cannot deactivate themselves, demote
  themselves to `agency_admin`, or delete their own admin record — otherwise the
  registry could be left with no one able to manage it.
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
