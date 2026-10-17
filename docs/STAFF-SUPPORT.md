> Complaint permissions and overview behavior are now superseded by [Complaint assignment and privacy](COMPLAINT-ASSIGNMENT.md). Staff see assigned complaints only; complaint overview cards are Admin-only.

﻿# Staff booking and complaint management

The staff workspace reuses Appointment, AppointmentSlot, Complaint, the existing
JWT middleware, notifications, and student/admin support workflows.

## Permissions

- Student booking and complaint endpoints always filter by the authenticated student.
- Approved, active staff can list, read, and update only appointments assigned to
  their own staff account. A different staff member's record returns 404.
- Approved, active staff can review only complaints assigned to their own account. Student users and unapproved
  staff cannot access staff complaint APIs. Complaint descriptions, responses, and
  history are omitted from staff list responses and loaded through protected details.
- Administrators retain their existing support endpoints and university-wide access.
- Client role claims, student/staff identifiers, and unsupported update fields do
  not override database permissions or ownership.

## Booking rules

Bookings are the existing **staff appointments**, not a separate room reservation
system. The resource is the assigned staff member and the time is an explicitly
published availability slot. Optional location metadata describes the office,
room, or online meeting and is published by an administrator.

The existing unique `(staff, startsAt)` availability index and unique sparse
`reservedSlot` index prevent duplicate published times and concurrent reservations.
Pending and Approved bookings reserve the slot. Rejected and Cancelled bookings
release it. Closed/past availability and inactive/unapproved staff cannot accept
new bookings. Existing bookings survive closing availability.

- Pending -> Approved, Rejected, Cancelled
- Approved -> Completed, Rejected, Cancelled
- Completed, Rejected, Cancelled are terminal.
- Future appointments cannot be completed; past appointments cannot be approved.

## Complaint rules

Students may select a category (General, Academic, Facilities, Student Services,
Safety, Other) and priority (Low, Medium, High, Urgent). Existing complaints use
General / Medium defaults; no existing records are overwritten.

Pending complaints can move to In Review, Resolved, or Rejected. In Review can move
to Resolved or Rejected. While open, staff may add a response without changing
status and may update priority. A nonempty response is required. Resolved and
Rejected are terminal. Each review atomically appends status, response, priority,
reviewer identity/role, and timestamp to history. Any legacy response is retained
when that record is first reviewed. The latest response remains in the existing
response field for student/admin compatibility.

Staff updates require the displayed status and updatedAt timestamp. An atomic
conditional update rejects stale edits and prevents concurrent overwrites. The
confirmation screen and submission lock also prevent accidental duplicate saves.

## Routes and overview

- GET /api/staff/support-overview
- GET /api/staff/bookings and GET/PATCH /api/staff/bookings/:id
- GET /api/staff/complaints and GET/PATCH /api/staff/complaints/:id

Lists support validated paging, search, status, sort/order, and summary views.
Complaints additionally support priority/category filters. Booking search covers
full ID, student name/ID, and booking reason; complaints cover full ID, student
name/ID, and subject. Search is escaped and debounced.

The four overview cards count pending own bookings, future approved own bookings,
unresolved university complaints (Pending / In Review), and unresolved High/Urgent
complaints. Cards link directly to the corresponding server-filtered view.
Dates and times display in the viewer's local timezone; stored timestamps are UTC.

## Verification

Run from the repository root:

```powershell
npm.cmd test --prefix backend
npm.cmd run test:integration --prefix backend
npm.cmd run build --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run test:e2e --prefix frontend
```

Integration and browser tests create uniquely named fixtures and delete only their
own records. They use the configured MongoDB database and require network access.
The new tests cover reservation races, lifecycle transitions, slot release,
resource ownership, unapproved staff/student access, complaint response history,
legacy compatibility, stale updates, data-backed metrics, filtering, pagination,
responsive navigation, error recovery, and student-visible persisted responses.

## Files changed

- Frontend: `src/App.jsx`, `src/pages/StaffLayout.jsx`,
  `src/pages/StaffDashboard.jsx`, `src/pages/StaffSupport.jsx` (new),
  `src/pages/Support.jsx`, `src/admin/AdminUI.jsx`, `src/styles/staff.css`,
  `tests/staffSupport.spec.js` (new).
- Backend: `controllers/supportController.js`, `routes/staffRoutes.js`,
  `models/Appointment.js`, `models/AppointmentSlot.js`, `models/Complaint.js`,
  `utils/supportWorkflow.js` (new), `tests/staffSupport.integration.js` (new),
  `tests/security.test.js`, `package.json`.
- Documentation: `docs/STAFF-SUPPORT.md` (new).

Verified for this change: frontend build and lint passed; all 33 backend unit /
security tests passed; all 3 real-database integration workflows passed; the 4
existing browser workflows and the new staff-support lifecycle workflow passed.
Desktop (1280 px), tablet (820 px), and mobile (390 px) layouts were checked,
including mobile navigation and page overflow. Test records were cleaned up.
