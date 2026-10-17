# Staff registration, approval and department workspace

## Using the feature

Start the existing application with `npm.cmd start` from the repository root (or double-click `Start-University-System.cmd`). Keep the terminal open. No new runtime dependencies are required.

1. Open `/login` and choose **Staff Portal**, or go directly to `/staff/register`.
2. Enter a name, valid university email, optional employee/staff ID, department, password and matching confirmation. Passwords follow the existing policy: at least eight characters, at most 72 UTF-8 bytes. Staff IDs are normalized to uppercase and are unique when provided; emails remain unique across every role.
3. Submission creates an active **staff** account with **pending** approval. No JWT is issued. Login displays “Your account is awaiting administrator approval.”
4. Sign in using an existing administrator at `/admin/login`, then open **Staff approvals** (`/admin/staff-approvals`). Search and filter registrations, review the details, verify the staff identity through university records and select the verified department. Approve or reject using the confirmation dialog.
5. Approved, active staff sign in at `/staff/login` and land at `/staff`. They can search, filter, inspect and process requests for their department, using the existing status workflow and staff comments. Student contact details match the existing request-management view.
6. Admins can find approved and rejected accounts using the status filter and review them again. Rejection blocks login and all existing staff sessions at their next API request. Approval does not reactivate an inactive account; use existing Admin user management for reactivation.

## Department authority and historical records

The existing Service collection is the department catalogue. `/api/auth/departments` returns its distinct department names, including inactive services because historical requests still need processing. There is no separate hard-coded list. Configure departments through existing Admin service management. If there are no services, registration displays a configuration message. The existing `npm.cmd run import:catalogue` command can import missing standard services without overwriting records.

Registration department is a request for review, not a permission grant. Admin approval validates and stores the verified department. Every authenticated call reloads the User's role, active flag, department and approval status from MongoDB. JWT and browser values cannot override them.

Staff request queries match `Request.serviceRef` against Service IDs whose current `department` exactly matches the authenticated User's department. Listing, counts, individual reads and updates all apply this scope. Changing a department query parameter does not change scope; an out-of-scope ID returns 404. Inactive services remain in scope. An Admin's later change to a service's department transfers its linked requests to the new department on subsequent requests. Scope is resolved afresh for each operation; a concurrent catalogue edit does not cancel an operation already in progress.

Legacy requests without a `serviceRef`, or with a deleted service, are excluded from staff access. Admins retain access. No automatic name-based association is performed because historical names may be ambiguous. Link such a request only after an administrator verifies the service relationship through a separately reviewed maintenance change; this feature never rewrites historical requests.

## Existing-account strategy and indexes

No destructive migration or bulk approval is performed. Students and administrators retain their current access. Existing staff without `approvalStatus` are treated as pending, listed in the pending review queue and denied login/protected resources until reviewed. The review update also supports legacy records without an `updatedAt` value, using a conditional null/missing timestamp match.

Admin-created staff and accounts newly changed to the staff role also require approval. Re-promoting a previously changed account to staff resets approval to pending. Admins can verify or correct a missing/old department in Staff approvals. Existing account identity, requests, passwords and roles are not rewritten by startup.

The User model adds optional department/staffId fields, a staff approval default, approval status/department indexes, a sparse unique staffId index and review metadata. Startup initializes User indexes before accepting requests. The staffId field is optional and is omitted when blank. Duplicate-key races return a safe HTTP 409 through the existing error handler. Existing staff are excluded from new request assignment and appointment availability until approved. Existing assignments and booked appointments are preserved.

Each review stores `reviewedBy`, `reviewedAt` and an appended `approvalHistory` entry with the decision and verified department. History is hidden by default and returned only by the Admin staff-details endpoint. Review writes require the observed approval state and update timestamp and match the staff role. Conflicting or repeated submissions of the same review return 409; reload details before trying again. The history uses the existing MongoDB persistence approach; it is not a separate immutable audit service.

## API additions

| Method | Path | Authorization |
| --- | --- | --- |
| GET | `/api/auth/departments` | Public department names |
| POST | `/api/auth/staff/register` | Public; server forces staff/pending |
| GET | `/api/admin/staff-registrations` | Admin list, pagination, search and approval/department filters; summary totals |
| GET | `/api/admin/staff-registrations/:id` | Admin details and review history |
| PATCH | `/api/admin/staff-registrations/:id` | Admin review with `approvalStatus`, `expectedStatus`, `expectedUpdatedAt`, `department` |
| GET | `/api/staff/dashboard` | Approved active staff; scoped counts for all five statuses |
| GET | `/api/staff/requests` | Approved active staff; existing request list filters and pagination |
| GET | `/api/staff/requests/:id` | Approved active staff; scoped details and allowed transitions |
| PATCH | `/api/staff/requests/:id` | Approved active staff; status, expectedStatus, optional expectedUpdatedAt and staffComment only |

The existing login endpoint accepts `portal: "staff"` as well as student/admin. Department and approval details in session responses come from the User record. Password hashes are never returned. Public role and approval metadata are ignored; there is no public Admin registration.

Staff cannot change student, service, department, assignment, notification events or Admin-only fields. Shared request processing preserves the existing transition rules, conditional database writes and persisted notification outbox. The shared editor supplies `expectedUpdatedAt` to detect stale comments or other edits even when status did not change; older callers remain compatible. Staff notifications use existing request-update delivery; no new email/approval notification service is claimed.

Email format is validated, but no institution-specific domain restriction or email verification is added because no authoritative university domain was supplied. Approval requires independent university verification; a selected department or email alone never approves an account.

## Implementation files

- User/authentication: `backend/models/user.js`, `backend/controllers/authController.js`, `backend/middleware/authMiddleware.js`, `backend/routes/authRoutes.js`, `backend/utils/staffAccess.js`, `backend/utils/departments.js`, `backend/server.js`.
- Admin approvals: `backend/controllers/staffApprovalController.js`, `backend/routes/adminRoutes.js`, `frontend/src/admin/StaffApprovals.jsx`, `frontend/src/admin/AdminLayout.jsx`.
- Scoped requests: `backend/middleware/departmentScope.js`, `backend/routes/staffRoutes.js`, `backend/controllers/adminRequestController.js`, `backend/app.js`, `frontend/src/admin/AdminRequests.jsx`, `frontend/src/pages/StaffDashboard.jsx`.
- Staff assignment and role compatibility: `backend/controllers/adminUserController.js`, `backend/controllers/supportController.js`, `frontend/src/admin/AdminUsers.jsx`.
- Registration/navigation/design: `frontend/src/pages/StaffRegister.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/PortalSelection.jsx`, `frontend/src/pages/Profile.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/App.jsx`, `frontend/src/admin/shared.css`, `frontend/src/styles/login.css`.
- Verification: `backend/tests/staff.test.js`, `backend/tests/staff.integration.js`, `backend/tests/integration.db.js`, `backend/package.json`, `frontend/tests/staff.spec.js`, `frontend/tests/login.spec.js`.
- Documentation: this file and `README.md`.

## Verification commands

```powershell
cd backend
npm.cmd test
npm.cmd run test:integration
cd ../frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

Unit tests require no database. Integration and browser tests require normal network access to the configured MongoDB instance and use temporary uniquely named fixtures, removing their own records afterward. Run the integration and browser suites separately to avoid affecting the original suite's global metric assertions. Browser tests use installed Chrome and isolated test-server ports 5002 and 5174.

## Verified results — 17 October 2026

- `backend`: `npm.cmd test` — **32 passed**.
- `backend`: `npm.cmd run test:integration` — **2 passed**, including actual registration/approval/rejection, password hashing, duplicate identifiers, review history, session revocation, department isolation, legacy-account review without timestamps and existing student/Admin workflows. Fixture cleanup preserved pre-existing records.
- `frontend`: `npm.cmd run build` and `npm.cmd run lint` — **passed**.
- `frontend`: `npm.cmd run test:e2e` — the **3 existing browser scenarios passed** on the final full-suite run. The staff scenario initially revealed an overly broad test status locator; after correcting the locator, `npm.cmd run test:e2e -- staff.spec.js` — **1 passed**. The four scenarios have therefore all passed, with the staff scenario rerun separately. A prior failure also exposed a department label association, which was corrected in the application. The old network-error assertion was updated to match the existing startup fix.
- `frontend`: `npm.cmd run test:ui` — **7 passed**, covering responsive layout, support forms, Admin navigation, empty staff setup and themes.
- Mobile staff dashboard screenshot inspected at 390px width, with no page overflow; Admin approvals screenshot inspected on desktop. Screenshots are generated in ignored `frontend/test-results` and may be replaced by later test runs.
- Root `npm.cmd start` successfully connected to MongoDB and started the updated app. New page routes and the department/catalogue APIs returned HTTP 200 through `http://localhost:5173`.

All tests use the existing Node test runner and Playwright; no framework or runtime dependencies were added. MongoDB requires the configured network access; the restricted sandbox's Atlas DNS timeout was avoided by running database and Chrome checks with normal network access.
