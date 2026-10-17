# Staff registration, approval and assigned requests

## Registration and access

Staff register with exactly name, email, Staff ID and password. The backend forces
staff / pending approval and normalizes unique Staff IDs. Administrators review
identity and approve or reject registration. Existing JWT, bcrypt, rate limiting,
role checks, and approval checks remain in place. Pending, rejected, and inactive
staff cannot access protected staff features. Roles and approval are reloaded from
the database on every API request.

Existing staff accounts and approval history remain intact. Missing legacy Staff
IDs are not invented. The read-only `npm.cmd run audit:staff-ids --prefix backend`
command remains available before any separately planned ID normalization.

## Request assignment and authorization

1. A student submits a request through the existing service workflow.
2. The request is initially unassigned and visible to administrators and its owner.
3. An administrator opens Admin > Requests > Review, selects an approved, active
   staff member under Assigned staff, then reviews and confirms changes.
4. The assignee can now list, search, filter, read and process the request.
5. Admin can reassign or clear the assignment. The former assignee loses access
   on their next API call, including if they already opened the details dialog.

Staff request lists, pagination totals, dashboard totals and status counts all
include `{ assignedStaff: authenticatedUser.id }`. Department and search filters
are additional criteria and cannot broaden access. A request from any department
can be handled if the administrator assigns it; department alone grants no access.

Staff detail lookups and initial update lookups use the same assignment condition.
An unassigned or differently assigned request returns 404. The atomic update also
requires that the assignment, status and updatedAt value still match. A request
reassigned during a staff save cannot be changed by the old assignee.

Staff can change permitted status and staff comments only. Student identity,
service association, assignment and administrative fields remain protected. The
existing five stored statuses and valid transitions are retained; the In Progress
navigation continues to filter the stored Processing status. Notifications and
student ownership are unchanged. Admin request access remains system-wide.

## APIs and database

| Endpoint | Staff access |
| --- | --- |
| GET /api/staff/dashboard | Counts only the authenticated staff member's assigned requests |
| GET /api/staff/requests | Searches and pages only their assigned requests |
| GET /api/staff/requests/:id | Assigned requests only; otherwise 404 |
| PATCH /api/staff/requests/:id | Assigned requests only; atomic assignment/status/timestamp guard |

Existing `/api/admin/requests` and `/api/admin/requests/:id` endpoints retain
system-wide reads, updates and assignment management. Assignment candidates must
be active, approved staff. Student routes derive ownership from the signed-in
account and cannot accept a forged student identity.

No endpoint or model is duplicated. `backend/utils/requestScope.js` shares the
staff assignment condition between the request controller and dashboard route.
A nonunique `(assignedStaff, status, createdAt)` index supports staff queries. No
records are reset, backfilled or automatically assigned. On deployments that
disable automatic index creation, create this declared index using the normal
database deployment process. Existing unassigned requests remain unassigned until
an administrator assigns them.

Booking and complaint workflows are unchanged by this request-access update; see
[staff support management](STAFF-SUPPORT.md) for their separate authorization rules.

## Verification

```powershell
npm.cmd test --prefix backend
npm.cmd run test:integration --prefix backend
npm.cmd run build --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run test:e2e --prefix frontend
```

Unit tests verify list/count scoping, protected direct reads/writes, department
filter composition, rejected protected fields and the atomic reassignment guard.
Real-database tests cover unassigned requests, admin assignment, reassignment,
unassignment, two staff identities, status updates, student ownership, approval
revocation and admin-wide visibility. The staff browser workflow assigns work
through the Admin UI and verifies the staff list, counts, updates, pagination and
hidden unassigned records. Fixtures are uniquely named and removed by ID.

## Files changed for assignment-only access

- Backend: `controllers/adminRequestController.js`, `routes/staffRoutes.js`,
  `models/Request.js`, and the new `utils/requestScope.js`.
- Frontend: `pages/StaffDashboard.jsx`, `pages/StaffLayout.jsx`,
  `pages/Profile.jsx`, and `admin/AdminRequests.jsx`.
- Tests: `backend/tests/staff.test.js`, `backend/tests/staff.integration.js`,
  and `frontend/tests/staff.spec.js`.
- Documentation: `README.md` and this file.

No data migration or API endpoint changes are required. Start the existing local
application with `npm.cmd start` from the repository root. An administrator uses
Admin > Requests > Review > Assigned staff > Review changes > Confirm changes.
After signing in as that staff member, the assigned request appears in their list
and overview. Unassigned requests remain in the Admin portal until assigned.

Verified for this update: all 35 backend unit/security tests, all 3 MongoDB
integration workflows, and all 5 browser workflows passed. Frontend production
build and lint passed. Existing test fixtures were cleaned up. The configured
local API was restarted successfully with MongoDB connected.
