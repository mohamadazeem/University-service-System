# Unified homepage and login

The homepage (`/`) and `/login` now use one centered login panel with three role choices: **Student**, **Staff / Lecturer**, and **Admin**. The old three-card portal layout and large homepage illustration are no longer rendered. The existing University Services brand, blue/navy theme, typography, theme toggle and form components are retained.

## Routes and behaviour

| Entry point | Initial role | Successful login |
| --- | --- | --- |
| `/`, `/login`, `/student/login` | Student | `/dashboard` |
| `/staff/login` | Staff / Lecturer | `/staff` |
| `/admin/login` | Admin | `/admin` |

`Home.jsx` and `PortalSelection.jsx` reuse the same `Login.jsx` component. Role-specific routes remain valid for bookmarks, registration links and protected-route redirects. Switching roles updates the URL using replace navigation, keeps the email, and clears the password, visibility state and previous error. Browser Back/Forward also synchronizes selection. The role selector uses native radios with arrow-key support, one Tab stop for the group, a selected style, visible focus indicators and touch-friendly targets. The form and role controls are disabled while login is processing.

The welcome heading is **Welcome to University Services**, followed by **Access university services, manage requests, and stay updated in one place.** The panel is capped at 468px, with **Sign in to your account**, the role selector, university email, password, a show/hide control and one **Sign In** button. Layouts adapt to desktop, tablet and mobile using the existing light/dark theme tokens. There are no large portal cards or distracting illustrations.

- Student selection shows **New student? Create an account**, linked to `/register`.
- Staff selection shows **New staff member? Register for approval**, linked to `/staff/register`, and explains the approval requirement.
- Admin selection shows the authorized-account guidance and no public registration link.
- No forgot-password link is shown because the existing project has no recovery endpoint.
- Public service browsing remains available in the header. Signed-in users also see **My dashboard**, derived from their current account role.

## Authentication and compatibility

The shared form still calls `AuthProvider.login(email, password, portal)` and the existing `POST /api/auth/login`. The selected role is only the requested portal; it is never used to create a role, forge a session or grant access. Backend password verification, stored role checks, approval checks, rate limiting, JWT creation, `/auth/me` verification, API interceptors, storage, logout and protected-route guards were not changed.

Only approved, active staff can sign in. Pending accounts show the existing administrator-approval message. Rejected or inactive accounts remain denied. A student selecting Admin still receives a backend denial. Redirects after successful login use the returned account's role. Existing student registration, four-field staff registration, services, dashboards, requests, appointments, complaints and notifications remain connected to their original pages and APIs.

No backend changes, database migration, environment changes or dependencies are required for this redesign. Run `npm.cmd start` from the root and open `http://localhost:5173`. If the development server is already running, refresh the browser to see the updated homepage.

## Modified files

- `frontend/src/pages/Login.jsx`: shared layout, role switcher, existing login submission and role-specific guidance.
- `frontend/src/pages/Home.jsx`, `frontend/src/pages/PortalSelection.jsx`: aliases of the shared component.
- `frontend/src/App.jsx`: all existing login aliases use the same component without role-specific duplicate forms.
- `frontend/src/components/Navbar.jsx`: avoids a duplicate header on the homepage/login routes.
- `frontend/src/styles/login.css`: single-panel layout, segmented selector, form/focus/loading styles and responsive sizing; staff registration styling retained.
- `frontend/tests/login.spec.js`, `frontend/tests/staff.spec.js`: real authentication scenarios updated for unified role selection.
- `frontend/tests/support.ui.spec.js`: responsive homepage, keyboard switching, request payload, error reset, registration-link and theme checks.
- `README.md`, this document and `docs/screenshots/README.md`: current behaviour and screenshot references.
- `docs/screenshots/unified-login-desktop.png`, `docs/screenshots/unified-login-mobile.png`: actual Chrome screenshots. Prior screenshots are retained as historical comparisons.

## Verification

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:ui
npm.cmd run test:e2e
cd ../backend
npm.cmd test
```

The UI suite uses explicit mocked API fixtures for layout, keyboard behaviour, error handling and themes. The real browser suite uses configured MongoDB and temporary uniquely named accounts and requests, deleting its own records afterward; it verifies actual Student, Staff and Admin authentication and request workflows. Installed Chrome and database network access are required. Do not run that browser suite concurrently with the database integration suite, which checks global metric differences.

Screenshots were inspected at 1440px desktop and 390px mobile widths. Tests also check tablet layout, role-specific links, password visibility, correct login payloads, denial messages, dashboard redirects, refresh/logout/expiry, authorization boundaries and loading/error recovery. No form overflow was observed. Password recovery remains outside the existing project's feature set.

### Actual results — 17 October 2026

- Frontend `npm.cmd run build`: passed.
- Frontend `npm.cmd run lint`: passed.
- Frontend `npm.cmd run test:ui`: **8 passed**, including the new keyboard/role/payload/link test and existing theme/support checks.
- Frontend `npm.cmd run test:e2e`: **4 passed** against MongoDB in Chrome, covering actual Student/Admin sessions, the Staff registration/approval/login/rejection workflow, request processing, support workflows and network/server failures.
- Backend `npm.cmd test`: **33 passed**. Backend source and authentication behaviour were unchanged.
- `git diff --check`: passed.

The UI suite first found a native-radio timing issue during role changes after a failed login. Selection now updates immediately while tracking route changes; the complete UI suite and real browser suite passed after that correction. Database-backed browser tests removed their own temporary records.
