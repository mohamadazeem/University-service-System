# Verification record — 15 October 2026

| Check                                      | Result                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Frontend production build                  | Passed                                                                               |
| Frontend ESLint                            | Passed                                                                               |
| Backend module loading                     | Passed                                                                               |
| Ten backend HTTP/security/validation tests | Passed                                                                               |
| MongoDB connectivity                       | Passed outside restricted sandbox                                                    |
| Real MongoDB integration workflow          | Passed                                                                               |
| Existing records                           | Two users and one request existed before testing; test cleanup targeted only new IDs |
| Browser interaction and console checks     | Not run: no browser-control surface available                                        |
| Desktop/mobile visual screenshots          | Not captured: same browser limitation                                                |
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
