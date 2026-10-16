# Current verification - 16 October 2026

- Frontend production build: passed.
- Frontend ESLint: passed.
- Backend security, notification reliability and startup tests: 20 passed.
- Chrome UI contract suite: 4 passed. Covers homepage at 1440/768/390px, student booking/complaints/notification read state, administrator availability/review and mobile sidebar. Also verifies missing-staff guidance, disabled publishing and staff-list refresh. Uses explicit API fixtures, not MongoDB.
- Real MongoDB integration: passed with network access enabled. Restricted-network attempts failed at Atlas SRV DNS lookup before assertions. The successful run verified all existing CRUD/authentication checks plus persisted support workflows; temporary records were cleaned.
- Real Chrome end-to-end suite: 3 passed against MongoDB. Includes registration/login, student/admin access boundaries, service requests, authentication errors, published availability, booking/approval, complaint resolution/response and notification read state across sessions and reloads. Temporary test data was cleaned. A test timing issue found during expansion was corrected before this passing run.
- git diff --check: passed.

Run the new UI suite with frontend npm.cmd run test:ui. Run the database suite with backend npm.cmd run test:integration. That suite now covers unique booking races, status changes, rejection/release, complaint responses, notification delivery/read/ownership, plus the existing CRUD/authentication checks. Cleanup targets only test-owned records, including notifications by test-owned user IDs.

See [ENHANCEMENT-REPORT.md](ENHANCEMENT-REPORT.md) for the audit, changed files and manual acceptance checklist. Environment files, credentials and pre-existing records were not modified in this run.

---

The following is a historical record from the previous implementation; its database and browser results do not validate the new support workflows.

# Verification record — 15 October 2026

| Check                                      | Result                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Frontend production build                  | Passed                                                                               |
| Frontend ESLint                            | Passed                                                                               |
| Backend module loading                     | Passed                                                                               |
| 14 backend security/validation/startup tests | Passed                                                                             |
| MongoDB connectivity                       | Passed outside restricted sandbox                                                    |
| Real MongoDB integration workflow          | Passed                                                                               |
| Existing records                           | Two users and one request existed before testing; test cleanup targeted only new IDs |
| Login browser workflows                    | Two Chrome tests passed; no uncaught page errors in the real login/request workflow   |
| Desktop/tablet/mobile login layouts         | Verified at 1280, 768 and 390 pixels; screenshots captured                             |
| Actual rubric PDF review                   | Not possible: PDF not attached                                                       |

Backend and frontend startup checks also passed: the updated API runs on port 5001, the frontend on 5173, and the Vite proxy returns the six persisted services. Unauthenticated admin access returns HTTP 401. The original six service offerings were imported without modifying existing records.

The real integration workflow verifies login/registration, forced student role, unauthenticated/student denial, privileged role claims ignored, service create/read/edit/deactivate/reactivate, duplicate names, request ownership, assignment/comment persistence, valid and stale/terminal status changes, user role/activation persistence, dashboard deltas, and admin list search/filter/sort/pagination.

Default backend tests use mocked model calls to isolate validation and authorization from database availability. This is distinct from the integration workflow, which uses MongoDB and verifies stored values through model reads.

## Reproduce

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
cd ../backend
npm.cmd test
npm.cmd run test:db
npm.cmd run test:integration
```

Integration tests create and clean their own IDs. They never call dropDatabase, deleteMany or a database reset. Use a development database and keep the process running until cleanup completes.

## Manual browser checklist

1. Provision an administrator and start the API/frontend using the README.
2. Register a student, sign in, browse active services, submit a request and reload My requests.
3. As a student, visit /admin and confirm redirection; confirm admin requests return 403.
4. Sign in as admin at /admin/login. Compare metric cards with stored records.
5. Create a service, search it, open details, edit, refresh and verify the changes persist.
6. Deactivate with confirmation; verify the service disappears from student browsing but old requests remain. Reactivate using Edit.
7. Review a student request; assign active staff, save a comment, approve/process/complete as allowed. Reload both portals.
8. Create a staff account, edit details and change its role; verify the old token uses the new role.
9. Deactivate/reactivate a non-admin. Try to deactivate/demote an admin and confirm the controls/server prevent it.
10. Test every filter, date boundary, sort direction, pagination button, retry and empty state.
11. At desktop, tablet and 390px mobile width, inspect navigation, sidebar opening/closing, tables scrolling, forms, charts and dialogs.
12. Use only the keyboard to open/close dialogs, Tab/Shift-Tab through controls, return focus and operate profile/logout.
13. Stop the backend to inspect network errors; restart and retry. Test expired/invalid sessions.
14. Check browser console/network for errors, then capture real screenshots.

No existing user credentials were used or changed during automated tests. The weak local JWT secret was rotated; session tokens issued before the change no longer authenticate.
