# Staff appointment availability

## Using the feature

Staff > Appointments provides Create Availability, refresh, search, date, service
and status filters. Select a catalogue category and service, supply title/purpose,
university date and start/end time, building, room, capacity (1–100), optional
duration and instructions. Publish immediately or save a draft. Staff require
normal administrator approval for their account, but not for each availability.

Students see published, future, nonfull availability on their Dashboard and
Appointments page. Booking details show the service, staff, location, schedule,
instructions and remaining capacity before confirmation. My Appointments lists
only the signed-in student's bookings and history. Students can cancel their
future Pending / Approved bookings with confirmation; the space becomes available
again. Staff review / approve / reject / complete bookings through the existing
Bookings page. Completing a future appointment remains prohibited.

Admin > Availability shows all staff slots and lets administrators publish,
inspect, edit or cancel them. The existing Admin > Appointments booking review and
legacy publication form remain available. All appointment display and input times
use **Asia/Colombo**. Stored instants remain UTC.

## Availability rules and permissions

- Approved active staff create and manage only their own slots. A client cannot
  supply a different owner. Other staff's details and updates return 404.
- Students cannot access availability management or student rosters. Their booking
  creation and cancellation use their authenticated identity, not a submitted ID.
- Admin can manage all staff availability and bookings through Admin-only routes.
- Draft slots reserve staff schedule space but are hidden from student discovery.
- Start must be future; end must follow start, within an eight-hour window.
  Optional duration cannot exceed the window. One booking reserves one space in
  the published window; duration is descriptive and does not generate sub-slots.
- Overlapping intervals for the same staff member are rejected; adjacent intervals
  are permitted. Building/room describes the location, not a separate room resource
  scheduler. Different staff can offer the same room unless separately managed.
- Booked slots protect service, start/end, capacity and publication status. Metadata
  (title, purpose, location, instructions, descriptive duration) can be changed;
  affected students receive persistent notifications. Schedule changes require
  cancellation and a replacement slot.
- Cancellation atomically cancels the slot and all Pending / Approved bookings;
  completed and already closed booking history is preserved. Cancelled/Closed
  availability cannot be edited through this workflow.
- The existing unique staff/start-time index remains in place. Exact reuse of a
  previously used staff/start timestamp is rejected, including a cancelled slot.
  No existing index or historical booking is deleted to allow reuse.

## Database consistency

MongoDB transactions require **Atlas or a replica set**. The configured Atlas
connection supports them. There is no unsafe standalone fallback: if transaction
support is missing, changes fail rather than reporting success or overbooking.

All reservation, cancellation, publication-edit and close operations write the
slot's revision in a transaction. Occupancy is counted from persisted Pending,
Approved and Completed bookings in the same transaction. Concurrent writers retry
with a fresh snapshot; a failed reservation consumes no capacity. Duplicate active
student bookings are additionally protected by a partial unique `(slot, student)`
index. Cancelling/rejecting clears that reservation flag. Existing single-capacity
`reservedSlot` uniqueness is retained for compatibility.

Concurrent schedule creation/changes also increment a private staff scheduling
version in their transaction. This serializes overlapping inserts that have
different start timestamps. It does not change account permissions or the account's
public updatedAt value. Notification events are saved atomically with the source
booking, then delivered through the existing persistent inbox / idempotent retry
mechanism. No email or push delivery is implied.

Existing slots remain usable: missing title/capacity use Staff appointment / 1,
missing end uses a 30-minute effective interval, and old active slots without a
publication field are treated as Published. Historical service-less slots retain
their location. No destructive data migration or collection reset is required.
Normal startup initializes the declared indexes before accepting bookings. If
production disables automatic index creation, deploy the new declared booking
indexes before enabling the new endpoints. No syncIndexes or index deletion is
used.

## Endpoints

| Method | Endpoint | Access / purpose |
| --- | --- | --- |
| GET, POST | /api/staff/appointment-slots | Own availability / create |
| GET, PATCH | /api/staff/appointment-slots/:id | Own roster / edit, publish draft or cancel |
| GET | /api/admin/appointment-slots | All staff availability |
| POST | /api/admin/appointment-slots | Publish for approved staff; legacy payload accepted |
| GET, PATCH | /api/admin/appointment-slots/:id | Admin roster / edit or cancel |
| DELETE | /api/admin/appointment-slots/:id | Existing close-only action; preserves existing bookings |
| GET | /api/appointments/availability | Student/Admin discovery, search/date/service filtering |
| GET, POST | /api/appointments | Student's own bookings / reserve a space |
| PATCH | /api/appointments/:id | Student cancellation with observed status/timestamp |

Updates require `expectedUpdatedAt`; booking status changes also require
`expectedStatus`. Existing Admin booking status updates remain compatible.
Student filters/pagination never broaden ownership. Appointment availability date
filters use a Sri Lankan calendar day (UTC+05:30 boundaries).

## Files and verification

Backend: `controllers/appointmentController.js` (new),
`controllers/supportController.js`, `models/AppointmentSlot.js`,
`models/Appointment.js`, `models/user.js`, the three staff/admin/support route
files, `package.json`, and `tests/availability.integration.js` (new).

Frontend: `pages/AppointmentAvailability.jsx` (new), `pages/StudentAppointments.jsx`
(new), `utils/appointmentTime.js` (new), `styles/appointments.css` (new), `App.jsx`,
`admin/AdminLayout.jsx`, `pages/StaffLayout.jsx`, `pages/Dashboard.jsx`,
`pages/StaffSupport.jsx`, `pages/Support.jsx`, `tests/availability.spec.js` (new)
and the updated UI-contract tests. The complaint search handler also avoids
restoring a just-cleared view when typing immediately after clearing filters.

```powershell
npm.cmd test --prefix backend
npm.cmd run test:integration --prefix backend
npm.cmd run build --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run test:e2e --prefix frontend
npm.cmd run test:ui --prefix frontend
```

Integration tests use uniquely named records and delete only owned fixture IDs.
They exercise same-staff schedule conflicts, concurrent overlapping inserts,
capacity races, duplicates, student ownership, staff ownership, draft visibility,
filters, booked metadata changes, stale edits, legacy slots, cancellation and
notification persistence. Browser tests publish availability through the staff UI,
book through two student sessions, verify location changes, release capacity,
cancel affected bookings and inspect desktop/tablet/mobile layouts.

Verified for this update: 35 backend unit/security tests, all 4 database integration
workflows (the 3 existing workflows and new availability coverage), all 6 browser
workflows, and all 8 UI contract tests passed. Production build and lint passed.
Loaded desktop, tablet and mobile availability pages were captured and inspected.
The new transaction and browser tests were rerun after batching cancellation /
metadata notification writes. Test fixtures were removed without changing existing
university records.
