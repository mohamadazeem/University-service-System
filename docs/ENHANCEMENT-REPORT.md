# Enhancement report - 16 October 2026

## Audit

Inspected React routes, pages, styles, authentication provider and dialogs; Express routes/controllers, JWT/role middleware, every Mongoose model, validation, tests, database/startup configuration and environment variable names. The working tree was clean initially. Environment values were not printed or modified.

Already implemented and retained: separate student/admin login, student-only registration, bcrypt passwords, database-authoritative roles/account activation, public catalogue, student dashboard/request submission/history/profile, admin user/service/request CRUD, live dashboard metrics/charts/recent requests, shared responsive styles and accessible dialogs. Profile remains read-only with administrator-managed updates.

Appointment, Complaint and Notification previously had schemas only. They now have APIs and interfaces. Existing document references remain references; file upload was not added.

## Design improvements

- Navy/blue homepage with Explore services and Sign in actions, original campus SVG, linked support cards, How it works, support guidance and footer. No invented official contacts, statistics or policies.
- Reused shared fields, panels, buttons, badges, loading/retry/empty states, notices, pagination and keyboard-accessible dialogs.
- Improved muted text contrast, SVG sidebar icons and support navigation in both portals.
- Added a real pending-request priority banner and connected its Pending filter.
- Preserved the existing polished authentication screens and live chart components.

## Workflows implemented

- Admins publish future appointment timestamps for active staff and close available times. Times are stored in UTC and displayed in the device timezone. Each timestamp is one opportunity, without duration scheduling. Availability returns the first 100 future unbooked times.
- Students book using their authenticated identity. A unique sparse reservedSlot index prevents simultaneous reservations. Pending appointments can be Approved/Rejected; Approved can be Completed/Rejected. Completion before the start is refused; rejection releases availability. Stale reviews return 409. Paginated student/admin history retains existing records.
- Students submit complaints; admins review, respond, resolve or reject. Responses are required on review. Both portals display status and the saved response. Terminal records cannot be reopened.
- Request submission/update, appointment booking/review and complaint submission/review persist notification events atomically with the source action. Delivery creates Notification records immediately where possible. Failed deliveries retain events for inbox retry. Unique event keys make retries idempotent. Inbox pagination, unread counts and ownership-scoped mark-as-read are implemented.
- Protected APIs reuse JWT verification and enforce stored database roles. Student lists and notification updates derive ownership from the current session. Submission fields are allowlisted and validated on the backend.

## Compatibility

Existing routes, status enums, data and authentication were preserved. Model changes are additive. No environment, credentials or existing database records were overwritten, and no dependencies or database reset were introduced. Startup waits for new uniqueness indexes before listening. Legacy appointments remain visible/reviewable and are not retroactively mapped to availability slots.

## Tests and remaining verification

Current results are in [TESTING.md](TESTING.md). The real MongoDB integration suite passed with network access enabled, including booking concurrency, complaint response persistence and notifications. Three real-browser tests also passed against MongoDB, including booking/approval, complaint resolution and persistent notification read state across sessions. Three API-fixture browser tests verify responsive UI behavior separately.

Manual acceptance and reproduction:

1. Run backend `npm.cmd run test:integration` and frontend `npm.cmd run test:e2e`. Keep tests running through cleanup of their own temporary records.
2. Publish availability, book as a student, reload both portals, approve/reject and confirm reservation release. Complete a past approved appointment.
3. Submit, review/respond/resolve a complaint and verify the response after reloading the student portal.
4. Check request/appointment/complaint notifications, mark read and reload; verify another account cannot read or change them.
5. Compare dashboard metrics to MongoDB, inspect charts across breakpoints and conduct screen-reader/keyboard acceptance across existing CRUD and new dialogs.

Not included: email, push/realtime notifications, recurring availability or appointment duration scheduling. The requested workflows passed database integration and real-browser persistence checks. No known requested core workflow remains unimplemented. Broader screen-reader and operational acceptance remain manual.

## Files changed

- `backend/app.js`
- `backend/controllers/RequestController.js`
- `backend/controllers/adminRequestController.js`
- `backend/controllers/supportController.js`
- `backend/models/Appointment.js`
- `backend/models/AppointmentSlot.js`
- `backend/models/Complaint.js`
- `backend/models/Notification.js`
- `backend/models/Request.js`
- `backend/routes/adminRoutes.js`
- `backend/routes/supportRoutes.js`
- `backend/server.js`
- `backend/tests/integration.db.js`
- `backend/tests/notifications.test.js`
- `backend/tests/security.test.js`
- `backend/utils/notificationEvent.js`
- `backend/utils/notifications.js`
- `docs/DATABASE.md`
- `docs/ENHANCEMENT-REPORT.md`
- `docs/IMPLEMENTATION.md`
- `docs/TESTING.md`
- `frontend/package.json`
- `frontend/playwright.config.js`
- `frontend/playwright.ui.config.js`
- `frontend/src/App.jsx`
- `frontend/src/admin/AdminDashboard.jsx`
- `frontend/src/admin/AdminLayout.jsx`
- `frontend/src/admin/AdminRequests.jsx`
- `frontend/src/admin/admin.css`
- `frontend/src/admin/shared.css`
- `frontend/src/assets/campus.svg`
- `frontend/src/components/Icon.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/hooks/useResource.js`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/pages/Notifications.jsx`
- `frontend/src/pages/Support.jsx`
- `frontend/src/styles/global.css`
- `frontend/tests/support.ui.spec.js`
- `frontend/tests/login.spec.js`
