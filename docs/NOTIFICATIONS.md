# Unified notifications

## Student workflow update — 18 October 2026

The existing persisted bell and inbox now open the specific Student record in a
details dialog on the existing My Requests, Appointments or Complaints page.
Links use `?notification=<id>`. An unread item is marked read successfully before
navigation; opening the dropdown does not mark items read. Reloading the details
link works, including after signing in again. Missing records show a clear notice
above the relevant list.

`GET /api/notifications/:id/related` extends the existing notification controller
and router. It requires a Student session, an owned notification and an owned
related entity. Responses use explicit field selections, excluding complaint
investigation notes. Staff and Admin retain their existing destinations.

- Request status, meaningful comment, priority and assignment changes produce
  useful Student updates. Identical saves return without writing another event.
- Approval notifications include service, Sri Lanka date/time and location when
  available. New booking rejections require a reason in both Staff/Admin forms
  and backend validation. The reason is saved on the booking and history, appears
  in the notification, Student booking list and details. Existing rejected records
  remain compatible without a reason.
- Complaint notices include subject, status and response summary. Identical saves
  and internal-notes-only changes do not produce Student alerts.
- Student availability, bookings, requests, complaints and open related details
  refresh every 30 seconds while visible and on focus. Publishing is discoverable
  without sending a broadcast to every Student. Existing transactional booking
  validation, cancellation notices and durable event retry/deduplication remain.

These are persisted in-app notifications. Other browser sessions can take up to
30 seconds to see an update; returning focus refreshes sooner. Email, mobile push
and WebSockets are not implemented. Booked schedules remain protected from edits:
Staff cancels and publishes a replacement when rescheduling is needed.

### Files modified for this update

Backend production files:
`controllers/adminRequestController.js`, `controllers/appointmentController.js`,
`controllers/complaintController.js`, `controllers/notificationController.js`,
`models/Appointment.js`, `routes/supportRoutes.js` (under `backend/`).

Frontend production files:
`src/components/NotificationItem.jsx`, `src/hooks/useResource.js`,
`src/pages/MyRequests.jsx`, `src/pages/Notifications.jsx`, `src/pages/StaffSupport.jsx`,
`src/pages/StudentAppointments.jsx`, `src/pages/Support.jsx` (under `frontend/`).

Tests:
`backend/tests/availability.integration.js`,
`backend/tests/complaintAssignment.integration.js`, `backend/tests/integration.db.js`,
`backend/tests/notifications.integration.js`, `backend/tests/staffSupport.integration.js`,
`frontend/tests/availability.spec.js`, `frontend/tests/login.spec.js`,
`frontend/tests/staffSupport.spec.js`, `frontend/tests/support.ui.spec.js`.
Documentation: `docs/NOTIFICATIONS.md`.

The real browser notification scenario creates actual business events through the
existing API and database, then clicks the real bell. It checks all three details
destinations, individual read counts/timestamps, refresh, re-login, a removed
record, Staff booking delivery and focus-driven slot discovery. Existing browser
flows separately exercise Staff publishing and review through the UI. Production
notifications are never mocked; the separate UI contract suites retain fixtures
for error and responsive-state coverage.

### Validation for the Student workflow update

| Location | Command | Actual result |
| --- | --- | --- |
| backend | `npm.cmd test` | 37 passed |
| backend | `npm.cmd run test:integration` | All 6 suites passed against MongoDB |
| frontend | `npm.cmd run lint` | Passed |
| frontend | `npm.cmd run build` | Passed |
| frontend | `npm.cmd run test:ui` | 9 passed |
| frontend | `npm.cmd run test:notifications` | 4 passed |
| frontend | `npm.cmd run test:e2e` | All 8 real browser workflows passed together in the final run |
| frontend | Isolated real Student notification navigation scenario | Passed against the actual backend and database |

The first combined browser runs identified a fixture delivery assumption, an
ambiguous notification-title selector and repeated test logins exhausting the
existing IP limit. The fixture now fetches Staff delivery, clicks the exact
notification ID and reuses successfully authenticated test sessions while
retaining a fresh-login check. The production login limit was preserved.

The sections below document the original shared notification implementation.

Student, approved Staff/Lecturer and Admin headers use the same notification bell.
The existing Notification collection and durable source-event mechanism are retained;
no records need to be reset or migrated to a separate collection.

## Behavior

- The badge shows the signed-in user's unread count, hides at zero and caps at `99+`.
- The dropdown shows the latest five notifications with titles, descriptions, types,
  timestamps, read state, destination links, individual read actions and mark-all.
- The existing role-specific Notifications pages support read/type filters and
  pagination. Newest-first sorting is enforced by the server.
- Counts and open inboxes refresh every 30 seconds while visible, on window focus,
  after read actions, and after successful business mutations in the current browser. Opening the dropdown refreshes recent items. This is
  persisted polling, not WebSockets.
- Escape returns focus to the bell. Outside clicks and moving focus outside close
  the dropdown. Its position is clamped to the viewport for wrapped/mobile headers.
- Old notifications without metadata display as general university updates.
  Destinations are derived from known event types and the current role, rather than
  accepting arbitrary URLs from notification text.

## Recipients and business operations

| Operation | Recipients |
| --- | --- |
| Service request submission | Student; Admin review queue |
| Request assignment/reassignment | Student; new/previous assigned Staff |
| Request status/comment update | Student; assigned Staff for Admin updates |
| Admin changes request priority | Student; assigned Staff |
| Appointment booked | Student; owning Staff; Admin review queue |
| Appointment reviewed/cancelled | Student; owning Staff |
| Slot location/instructions changed or availability cancelled | Affected Students and owning Staff |
| Complaint submitted | Student; Admin review queue |
| Complaint assigned/reassigned | Student; new/previous assigned Staff |
| Complaint response/status/priority updated | Student; assigned Staff for Admin updates |
| Staff registration submitted | Admin review queue |
| Staff registration approved/rejected | Relevant Staff account |

**Admin review-queue policy:** exactly one active Admin receives shared review
alerts: the account with the lowest MongoDB ObjectId (the oldest account ID).
The recipient is resolved when delivering queued alerts; if that Admin becomes
inactive, the next active Admin receives undelivered alerts. Alerts are not
broadcast to all administrators. With no active administrator, events remain queued.
Individual administrative updates still target the affected account.

Pending/rejected Staff remain unable to authenticate, as before. Their decision
notifications persist, but inbox access does not bypass approval restrictions.

## API and consistency

All endpoints require the existing authenticated session/token:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/notifications?page=1&limit=10&read=unread&type=request` | Current user's paginated inbox; includes total and global unread count |
| GET | `/api/notifications/unread-count` | Current user's unread count |
| PATCH | `/api/notifications/:id/read` | Mark one owned notification read; persist read timestamp |
| PATCH | `/api/notifications/read-all` | Mark current user's unread notifications read |

Read filters: `read`, `unread`, or omitted. Types: `request`, `appointment`,
`complaint`, `staff-approval`, `general`, or omitted. Recipient query/body fields
cannot select another inbox. The server validates IDs and returns only the inbox
fields needed by the UI, excluding recipient IDs and internal delivery keys.

Events are saved with their source business write and delivered with a unique
event key. Appointment writes retain MongoDB transactions and booking guards.
Delivery retries do not duplicate an event. Failures preserve queued events and
do not convert successful business operations into failed responses. Removing a
delivered event uses `timestamps: false`, so delivery cannot invalidate optimistic
concurrency timestamps on requests, appointments, complaints or approvals.

Notification indexes cover recipient/newest-first listing and recipient/read-state
listing. The existing unique event-key index is retained.

## Verification

Executed on 18 October 2026:

| Location | Command | Actual result |
| --- | --- | --- |
| backend | npm.cmd test | 37 passed |
| backend | npm.cmd run test:integration | 6 passed in the final combined run |
| frontend | npm.cmd run lint | Passed |
| frontend | npm.cmd run build | Passed |
| frontend | npm.cmd run test:notifications | 4 passed |
| frontend | npm.cmd run test:ui | 8 passed |
| frontend | npx.cmd playwright test tests/availability.spec.js | 1 passed; verifies immediate badge after a real booking |
| frontend | Targeted login/support and Staff support rerun | 2 passed |

The real-browser regression command was also executed. Its old Admin slot-publishing
expectation and notification selectors were updated to the current Staff publishing
workflow and shared notification item. The login/support and Staff support workflows
then both passed in a targeted rerun; the other four scenarios had passed in the
suite run. The final availability rerun also passed with the immediate real-booking badge assertion. All six distinct existing browser workflows passed across the suite run and targeted reruns; the full browser command was not rerun as one final six-test invocation.

Notification UI contracts cover all three roles, latest-five ordering, zero/99+
badges, destinations, read/type filters, pagination, individual/all read actions,
refresh persistence, outside click/Escape behavior, loading/errors/retry, and widths
1440, 820 and 390. Screenshots were visually inspected. Database tests independently
cover actual recipients, persisted events, re-login, cross-user access rejection,
failed writes, duplicate delivery and retained events after delivery failures.
The integration/browser suites create uniquely identified fixtures and remove
only their own records. UI contract tests use explicit fixtures; real database
persistence, delivery and ownership are checked separately by integration tests.

## Modified files

- [README.md](../README.md)
- [backend/controllers/RequestController.js](../backend/controllers/RequestController.js)
- [backend/controllers/adminRequestController.js](../backend/controllers/adminRequestController.js)
- [backend/controllers/appointmentController.js](../backend/controllers/appointmentController.js)
- [backend/controllers/authController.js](../backend/controllers/authController.js)
- [backend/controllers/complaintController.js](../backend/controllers/complaintController.js)
- [backend/controllers/notificationController.js](../backend/controllers/notificationController.js)
- [backend/controllers/staffApprovalController.js](../backend/controllers/staffApprovalController.js)
- [backend/controllers/supportController.js](../backend/controllers/supportController.js)
- [backend/models/Notification.js](../backend/models/Notification.js)
- [backend/models/user.js](../backend/models/user.js)
- [backend/package.json](../backend/package.json)
- [backend/routes/supportRoutes.js](../backend/routes/supportRoutes.js)
- [backend/tests/integration.db.js](../backend/tests/integration.db.js)
- [backend/tests/notifications.integration.js](../backend/tests/notifications.integration.js)
- [backend/tests/notifications.test.js](../backend/tests/notifications.test.js)
- [backend/utils/notificationEvent.js](../backend/utils/notificationEvent.js)
- [backend/utils/notifications.js](../backend/utils/notifications.js)
- [docs/NOTIFICATIONS.md](../docs/NOTIFICATIONS.md)
- [frontend/package.json](../frontend/package.json)
- [frontend/playwright.config.js](../frontend/playwright.config.js)
- [frontend/playwright.notifications.config.js](../frontend/playwright.notifications.config.js)
- [frontend/src/admin/AdminLayout.jsx](../frontend/src/admin/AdminLayout.jsx)
- [frontend/src/api/client.js](../frontend/src/api/client.js)
- [frontend/src/components/Navbar.jsx](../frontend/src/components/Navbar.jsx)
- [frontend/src/components/NotificationBell.jsx](../frontend/src/components/NotificationBell.jsx)
- [frontend/src/components/NotificationItem.jsx](../frontend/src/components/NotificationItem.jsx)
- [frontend/src/hooks/useNotifications.js](../frontend/src/hooks/useNotifications.js)
- [frontend/src/hooks/useResource.js](../frontend/src/hooks/useResource.js)
- [frontend/src/pages/Notifications.jsx](../frontend/src/pages/Notifications.jsx)
- [frontend/src/pages/StaffLayout.jsx](../frontend/src/pages/StaffLayout.jsx)
- [frontend/src/styles/notifications.css](../frontend/src/styles/notifications.css)
- [frontend/tests/availability.spec.js](../frontend/tests/availability.spec.js)
- [frontend/tests/login.spec.js](../frontend/tests/login.spec.js)
- [frontend/tests/notifications.ui.spec.js](../frontend/tests/notifications.ui.spec.js)
- [frontend/tests/support.ui.spec.js](../frontend/tests/support.ui.spec.js)
