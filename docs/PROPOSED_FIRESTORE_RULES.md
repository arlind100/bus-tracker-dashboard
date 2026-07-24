# Proposed Firestore Rules Changes

> **STATUS: APPLIED AND DEPLOYED — 2026-07-24.** All three changes below are live
> in `bus-tracker-capstone`. They were applied to `firestore.rules` in the mobile
> repo (in that file's existing commented style rather than as the compact block
> quoted here) and released with
> `firebase deploy --only firestore:rules`.
>
> Verified post-deploy: `schedules` reads succeed unauthenticated (12 docs);
> unauthenticated writes to both `admins` and `schedules` return
> `permission-denied`. This file is kept as the design record — the deployed
> `bus-tracker/firestore.rules` is now the source of truth.

> **Why this file exists:** the mobile app repo is the single source of truth for
> `firestore.rules`, and it is **read-only** for this dashboard work. The rules
> are **shared** across the whole `bus-tracker-capstone` project, so they must be
> edited **in the mobile repo** and deployed from there.

## What the dashboard can do TODAY (no rule change needed)

With a normal `admins/{uid}` account (`active: true`, `role: 'admin'`), the
dashboard already has full read/write to: `routes`, `stops`, `buses`,
`busLocations`, `agencies`, `notifications`, `issueReports`, `adminUpdates`, and
public reads everywhere. **Phase 1 and most of Phase 2 work with today's rules.**

## What NEEDS a rule change (super-admin features)

| Feature | Collection | Today | Needed |
|---------|-----------|-------|--------|
| Manage the admin registry (create/deactivate/promote admins) | `admins` | `allow write: if false` | allow write for super admins |
| Timetable management (read + CRUD) | `schedules` | **no rule → all access denied** | public read + admin write |

## The changes (additive — every existing rule keeps working)

Add an `isSuperAdmin()` helper, open `admins` writes to super admins only, and
add a `schedules` block. Below is the **complete** proposed file — it is the
current `firestore.rules` plus three additions (marked `// ★ ADDED`).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function adminData() {
      return get(/databases/$(database)/documents/admins/$(request.auth.uid)).data;
    }

    function isAdmin() {
      return isSignedIn() &&
             exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
             adminData().active == true &&
             adminData().role == 'admin';
    }

    // ★ ADDED — super admin = an active admin whose doc also carries superAdmin: true.
    function isSuperAdmin() {
      return isAdmin() && adminData().superAdmin == true;
    }

    match /routes/{id}        { allow read: if true;  allow create, update, delete: if isAdmin(); }
    match /stops/{id}         { allow read: if true;  allow create, update, delete: if isAdmin(); }
    match /buses/{id}         { allow read: if true;  allow create, update, delete: if isAdmin(); }
    match /busLocations/{id}  { allow read: if true;  allow create, update, delete: if isAdmin(); }
    match /agencies/{id}      { allow read: if true;  allow create, update, delete: if isAdmin(); }
    match /notifications/{id} { allow read: if true;  allow create, update, delete: if isAdmin(); }

    // ★ ADDED — timetables. Public read (like other transit data); admin write.
    match /schedules/{id}     { allow read: if true;  allow create, update, delete: if isAdmin(); }

    match /issueReports/{id}  { allow create: if true; allow read, update, delete: if isAdmin(); }

    match /users/{uid}        { allow read, write: if isSignedIn() && request.auth.uid == uid; }

    // ★ CHANGED — was `allow write: if false`. Only super admins may manage the
    // admin registry from a client. Reads stay open to any signed-in user so the
    // isAdmin() check can resolve.
    match /admins/{uid}       { allow read: if isSignedIn(); allow write: if isSuperAdmin(); }

    match /adminUpdates/{id}  { allow read, write: if isAdmin(); }
  }
}
```

## Safety notes

- **Non-breaking:** the mobile app never writes `admins` or `schedules` from the
  client, so opening these does not change mobile behavior. A super admin still
  has `role: 'admin'`, so `isAdmin()` and the mobile gate keep passing.
- **Bootstrapping the first super admin:** because clients can only write
  `admins` once a super admin exists, the **first** `superAdmin: true` doc must
  be created out-of-band — via the **Firebase Console** or a trusted **Admin SDK**
  script. See the dashboard `README.md` → "Creating the first super admin".
- **Test before deploying:** the rules file is shared with production mobile.
  Validate in the Firebase Console **Rules Playground** first.
- **Agency scoping (future):** to enforce a real "company admin" tier, add an
  `agencyId` comparison (caller's `adminData().agencyId` vs the target doc's
  `agencyId`) on the write rules. Not included here — Phase 1 keeps super admins
  global and gates the extra UI on `superAdmin === true`.
