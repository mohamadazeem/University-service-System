# Staff registration, approval and all-department access

This document describes the current workflow. Approved staff can process all university service requests; account departments do not limit access.

## Use the feature

Start the existing app from the repository root with `npm.cmd start`, or double-click `Start-University-System.cmd`. Keep the terminal open.

1. Open `/staff/register` (also linked from the Staff Portal at `/login`). The form has exactly four fields in order: **Full Name**, **Email**, **Staff ID / Employee Number**, **Password**. All four are required. There is a show/hide password button, and no department or confirmation field.
2. Use any valid personal or university email. Passwords follow the existing policy: at least eight characters and at most 72 UTF-8 bytes. Submission displays: “Registration submitted successfully. Please wait for administrator approval before signing in.” No session is issued.
3. New accounts are always created as `role: staff`, `approvalStatus: pending`. Pending staff receive “Your account is awaiting administrator approval.” when trying to sign in. Rejected and inactive accounts are also denied.
4. An existing administrator signs in at `/admin/login`, opens **Staff approvals** (`/admin/staff-approvals`), searches by name/email/Staff ID, and reviews the account. Approve or reject through the confirmation dialog. A department is not required. Existing Admin filters for historical account departments remain available, but do not grant or restrict permissions.
5. Approved, active staff sign in at `/staff/login` and land at `/staff`. The dashboard counts all requests, with each of the five existing statuses. Staff can search, filter by department/status/priority/service, sort, paginate, open details, change permitted statuses and edit staff comments.
6. Admins can review approved or rejected accounts again. Rejection blocks login and existing sessions on the next API request. Approval does not reactivate an inactive account; existing user management still controls activation.

## Staff ID normalization and existing records

`backend/utils/staffId.js` supplies one normalization function for public validation and the User schema setter: trim surrounding whitespace and convert to uppercase. The normalized ID must be non-empty text of at most 50 characters. Public Staff registration requires it. Email remains normalized and unique across roles.

A duplicate check also matches legacy mixed-case or surrounding-whitespace Staff IDs. The existing sparse unique `staffId` index prevents races between new normalized registrations; duplicate-key errors return safe HTTP 409 messages through the existing error handler. No password hashes or database error internals are returned.

The User schema retains optional Staff IDs for backward compatibility. Existing staff without an ID are preserved and may be reviewed and approved normally. Approved existing staff do not lose access for lacking an ID or department. Pending/rejected legacy staff still need approval. Existing Admin account creation remains compatible and also creates pending staff accounts. This change does not invent employee numbers or rewrite existing account fields.

### Read-only preflight

Before changing indexes or migrating an older deployment, run:

```powershell
cd backend
npm.cmd run audit:staff-ids
```

The script reads raw records and existing indexes, prints only counts, and never changes accounts or indexes. It reports staff without IDs, invalid/non-normalized IDs, duplicate normalized ID groups, and whether the existing sparse unique index is present. If it finds conflicting or invalid values it exits with an error. An administrator must verify the affected identities and approve per-record corrections before normalization; do not bulk-normalize collisions or delete accounts. Missing IDs alone do not require migration.

For the configured database, the pre-change audit found **1 existing staff account without an ID, 0 invalid IDs, 0 non-normalized IDs, 0 duplicate normalized groups, and the sparse unique Staff ID index already present**. No index replacement or data migration was needed, and the existing account was preserved. If an older deployment lacks the index and its audit is clean, normal startup initializes the already-declared Mongoose indexes before listening. No collection reset, `syncIndexes`, bulk approval or automatic backfill is used.

Legacy `User.department` values and old approval-history department entries remain stored. New registration ignores browser-supplied department/role/approval metadata; review decisions no longer assign a department. Staff profile shows all-department service access.

## Authorization and request information

The existing JWT/bcrypt login, rate limiter, CORS and error handling are retained. Both login and authentication middleware verify staff approval. Middleware reloads the current account from MongoDB on every protected request. Browser roles, Staff IDs, approval flags and JWT role/department claims cannot grant permissions.

`/api/staff` requires an authenticated, approved, active staff account. The former department-scope middleware was removed. Request listing, counts, details and updates now include all departments, including inactive services, legacy unlinked requests and requests whose service is no longer available. An optional department filter is a user-selected search criterion, not an authorization boundary.

Service names remain historical request snapshots. The stored `serviceRef` ID is unchanged. The shared request APIs additionally populate a read-only `serviceDetails` virtual with the current service name and department. The shared Admin/staff request table and detail dialog display the department. Department filtering matches authoritative Service IDs. A legacy/unlinked/deleted service displays **Department unavailable**; its request remains accessible when no department filter is applied. No service-name inference or historical record rewrite occurs.

Staff can update only `status`, `expectedStatus`, optional `expectedUpdatedAt`, and `staffComment`. Ownership, student, service, department, assignment, approval and other Admin-only fields are rejected. The existing status transitions, conditional status/timestamp writes and request notifications remain in place. The shared editor sends the observed timestamp to detect stale edits. Nonexistent requests return 404.

Admin request/user/service/approval management remains Admin-only. Staff do not gain those permissions. Student endpoints remain student-only and derive request ownership from the authenticated account, ignoring browser ownership filters. Existing accounts, services, requests, assignments and appointments are retained.

## API

| Method | Endpoint | Access and purpose |
| --- | --- | --- |
| POST | `/api/auth/staff/register` | Public four-field registration; server forces staff/pending |
| POST | `/api/auth/login` | Existing login, with `portal: staff`, student or admin |
| GET | `/api/auth/departments` | Existing service department names for filters |
| GET | `/api/admin/staff-registrations` | Admin search, status/legacy-department filters, pagination and summary counts |
| GET | `/api/admin/staff-registrations/:id` | Admin details and review history |
| PATCH | `/api/admin/staff-registrations/:id` | Admin review: `approvalStatus`, `expectedStatus`, `expectedUpdatedAt` |
| GET | `/api/staff/dashboard` | Approved active staff; all-department request totals |
| GET | `/api/staff/requests` | Approved active staff; searchable, filtered, sorted, paginated requests |
| GET, PATCH | `/api/staff/requests/:id` | Approved active staff; details and permitted updates across departments |

Review writes still match the intended staff account, expected status and timestamp, reject self-review, and append the responsible Admin and timestamp to approval history. Legacy records without timestamps support a conditional null/missing timestamp check. Conflicts return 409. Password hashes are excluded; review history is selected only by the Admin details endpoint.

## Files changed for this update

- Registration and Staff IDs: `backend/models/user.js`, `backend/utils/staffId.js` (new), `backend/controllers/authController.js`, `frontend/src/pages/StaffRegister.jsx`.
- Read-only audit: `backend/scripts/audit-staff-ids.js` (new), `backend/package.json`.
- Approval: `backend/controllers/staffApprovalController.js`, `frontend/src/admin/StaffApprovals.jsx`, `frontend/src/admin/AdminUsers.jsx`.
- Requests: `backend/routes/staffRoutes.js`, `backend/controllers/adminRequestController.js`, `backend/models/Request.js`, `backend/utils/departments.js`, `frontend/src/admin/AdminRequests.jsx`, `frontend/src/pages/StaffDashboard.jsx`, `frontend/src/admin/shared.css`.
- Removed obsolete restriction: `backend/middleware/departmentScope.js`.
- Portal/profile copy and form spacing: `frontend/src/pages/Login.jsx`, `frontend/src/pages/PortalSelection.jsx`, `frontend/src/pages/Profile.jsx`, `frontend/src/styles/login.css`.
- Tests: `backend/tests/staff.test.js`, `backend/tests/staff.integration.js`, `backend/tests/integration.db.js`, `frontend/tests/staff.spec.js`.
- Documentation: this file and `README.md`.

Existing authentication middleware and role guards are reused unchanged. No runtime or testing dependencies were added.

## Test commands

```powershell
cd backend
npm.cmd run audit:staff-ids
npm.cmd test
npm.cmd run test:integration
cd ../frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
npm.cmd run test:ui
```

Unit tests require no database. Integration and browser tests use unique temporary fixtures and remove their own IDs, without resetting collections or changing pre-existing records. Run those two suites separately because the original integration suite checks global metric differences. Chrome must be installed; browser tests use API port 5002 and frontend port 5174. MongoDB requires normal network access.

## Practical limits

Email format is checked without institution-domain restrictions or email verification. Administrators must independently verify staff identities. Approval history is stored on the account; no new email service or immutable external audit service is introduced. Requests retain the existing current status, staff comment and timestamps; this update does not create a new status-history system. Unlinked legacy requests have no verifiable department until their service reference is maintained through a separate reviewed change, but approved staff can process them.

## Actual verification results — 17 October 2026

| Command / check | Result |
| --- | --- |
| Backend `npm.cmd run audit:staff-ids` | Passed; existing unique index present, no conflicting IDs, one existing staff account without an ID preserved |
| Backend `npm.cmd test` | **33 passed** |
| Backend `npm.cmd run test:integration` | **2 passed** against MongoDB; original workflows plus four-field registration, index uniqueness, all-department processing, student ownership, approval/revocation and legacy staff access |
| Frontend `npm.cmd run build` | Passed |
| Frontend `npm.cmd run lint` | Passed |
| Frontend `npm.cmd run test:e2e` | **4 passed** in the full Chrome suite |
| Frontend `npm.cmd run test:e2e -- staff.spec.js` | **1 passed** again after the final form-spacing adjustment; includes registration and dashboard mobile overflow checks |
| Frontend `npm.cmd run test:ui` | **7 passed**; responsive navigation, support screens, empty staff setup, themes and dialogs |
| `git diff --check` | Passed |
| Root `npm.cmd start` | MongoDB connected; updated API and frontend started at `http://localhost:5173` |

Inspected the final desktop form and mobile form/dashboard screenshots. The form contains exactly four inputs, with no selector or confirmation field, and fits a 390px-wide screen. Browser assertions verified show/hide password, pending login denial, Admin approval without a department selector, both departments in the request list, optional department filtering, staff status/comment processing, refresh persistence and rejection blocking an existing session.

The normal local app returned HTTP 400 with a Staff ID validation message when Staff ID was omitted, and HTTP 200 for the staff registration page and service catalogue. After fixture cleanup, the catalogue returned the six existing services. Test records were removed and no migration of pre-existing accounts was performed.
