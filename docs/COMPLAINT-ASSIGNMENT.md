# Complaint assignment and privacy

Students submit complaints to the Admin queue. They can read only their own
complaints, assignment status, public responses and resolution. Investigation
notes are internal: both root notes and history notes are redacted on every
student response. Student payloads cannot choose an assignee, reviewer or status.

## Admin workflow

Admin > Complaints Management lists all complaints, including legacy and unassigned
records. Search covers full complaint ID, subject and student name/email/ID. Filters
cover status, department, priority, assignment and UTC submission date range. Five
cards show total, unassigned, in-progress, resolved and High/Urgent unresolved
complaints. The main Admin dashboard links to the same management page and shows
these real database totals.

Open Review, select Assign Staff, choose a staff member, then Review assignment
and Confirm assignment. Reassign Staff follows the same flow. Eligible accounts
must be active, approved staff. Where a complaint has a department, choices are
restricted to the matching department and staff without a department restriction
(the project's existing university-wide support accounts). There is no invented
service-area permission or department requirement on staff registration.

Assignment stores assignedStaff, assignedBy, assignedAt and a permanent
assignmentHistory entry. An initial Pending complaint moves to In Progress.
Unassignment returns an open complaint to Pending; reassignment retains its open
progress. Closed complaints cannot be reassigned. Every assignment change sends a
persistent notification to the student. No email or push delivery is implied.

## Staff workflow

The Staff Dashboard has no complaint overview cards or university-wide complaint
counts. Its support overview API returns booking counts only. My Assigned
Complaints is separate from service requests and appointments.

All staff list/detail/update queries match the signed-in user's ID against
assignedStaff. Unassigned and other staff's complaints return no rows / HTTP 404,
including direct API calls. Search, filters and pagination cannot broaden scope.
The same assignment condition is included in the final atomic update, preventing
an old assignee from saving after reassignment. Admin assignment and global
statistics endpoints remain Admin-only.

Assigned staff can investigate, add internal notes and public responses, keep
working In Progress, and resolve a complaint. Public responses are required for
updates. Notes remain internal. Status and response history preserves actor,
timestamp and progress; assignment history records responsible administrators.
Historical In Review records are retained and can progress to In Progress or
Resolved. Rejected/Resolved are terminal. Administrators retain the legacy review
transitions for compatibility and oversight.

## Database and APIs

The existing Complaint model adds department, assignedStaff, assignedBy,
assignedAt, assignmentHistory and private investigation notes, plus history
metadata. Nonunique assignee/status and department/priority indexes support lists.
No existing complaint is automatically assigned, reset or deleted. Missing
assignment fields are treated as unassigned. Existing responses are preserved when
legacy complaints receive their first assignment. Normal startup initializes the
Complaint indexes; deployments with auto-indexing disabled should deploy the
schema-declared indexes through their regular database process.

- GET /api/admin/complaints: all complaints and validated filters.
- GET /api/admin/complaints/overview: Admin-only global summary.
- GET /api/admin/complaints/:id: Admin details and internal history.
- GET /api/admin/complaint-staff?department=...: eligible assignment choices.
- PATCH /api/admin/complaints/:id/assignment: assign/reassign/unassign with the
  observed expectedUpdatedAt timestamp.
- PATCH /api/admin/complaints/:id: review/respond under existing Admin privileges.
- GET /api/staff/complaints and GET/PATCH /api/staff/complaints/:id: assignee-only.
- GET/POST /api/complaints and GET /api/complaints/:id: student-owned data only.

Review updates use expectedStatus and expectedUpdatedAt to reject stale writes.
The existing JWT authentication, current-role checks, staff approval, notification
outbox, student ownership and assignment-only service requests are retained.
Appointment functionality is unchanged by this update.

## Files and verification

Backend: new controllers/complaintController.js and
 tests/complaintAssignment.integration.js; models/Complaint.js,
controllers/supportController.js, routes/adminRoutes.js, routes/supportRoutes.js,
utils/supportWorkflow.js, server.js, package.json and
 tests/staffSupport.integration.js.
Frontend: new admin/AdminComplaints.jsx and styles/complaints.css; App.jsx,
admin/AdminDashboard.jsx, admin/AdminLayout.jsx, pages/StaffDashboard.jsx,
pages/StaffLayout.jsx, pages/StaffSupport.jsx, pages/Support.jsx, styles/staff.css;
tests/login.spec.js, tests/staffSupport.spec.js and tests/support.ui.spec.js.

```powershell
npm.cmd test --prefix backend
npm.cmd run test:integration --prefix backend
npm.cmd run build --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run test:e2e --prefix frontend
npm.cmd run test:ui --prefix frontend
```

Database tests use uniquely named fixtures and remove only their own IDs. Coverage
includes submission, unassigned privacy, department eligibility, Admin assignment,
reassignment, former-assignee denial, student ownership, notes redaction, status
updates, legacy response preservation, summary accuracy and notification storage.
The browser workflow assigns and reassigns through Admin UI, verifies staff access
changes, responds/resolves through Staff UI and reads the outcome as the student.

Verified for this change: all 35 backend unit/security tests, all 5 database
integration workflows, all 6 browser workflows and all 8 UI contract tests passed.
Production build and lint passed. Admin mobile/desktop and assigned-staff views
were checked. The extended browser workflow reuses its real authenticated sessions
to avoid exhausting the unchanged login rate limit during repeated role switches.
Temporary fixture records were cleaned up. The local API was restarted with MongoDB
connected and assignment-only complaint access active.
