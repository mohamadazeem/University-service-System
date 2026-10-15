# Separate student and administrator login

The application retains React 19, Vite, React Router, Axios, Express 5, MongoDB/Mongoose, bcrypt and JWT authentication. Existing dashboards, collections and records are preserved. No database migration, environment changes or runtime dependencies are needed. Playwright is a development dependency for browser verification.

## Flow and access

- `/login`: University Services branding and two portal cards, side by side on desktop/tablet and stacked on mobile. No login form is shown here.
- `/student/login`: email/password, show/hide password, student registration and portal-selection links. Success opens `/dashboard`.
- `/admin/login`: administrator email/password and portal-selection links. Success opens `/admin`.
- Both forms call the existing `POST /api/auth/login` with an additional `portal` value (`student` or `admin`). The backend validates the password and compares the requested portal with the account's **stored MongoDB role** before signing a token. Selecting a portal cannot assign a role. Requests without `portal` remain compatible with existing API clients; protected endpoints still enforce database roles.
- Student dashboard, request submission and request tracking require a student on the frontend. Both request API endpoints also require a student. Admin routes and APIs require an administrator. Unauthorized users return to their own dashboard; staff retain shared profile access. The shared profile and public service catalogue remain accessible according to their existing purpose.
- Unauthenticated private routes redirect to the appropriate form. Expired/invalid sessions clear the stored session and show sign-in guidance. Valid tokens are revalidated through `/api/auth/me` on refresh. Sign out clears the token/user and returns to portal selection.
- Passwords are hashed with bcrypt and never persisted in the browser. Login preserves password whitespace, matching registration. JWTs retain the existing eight-hour expiry and localStorage strategy; this change does not migrate sessions to HttpOnly cookies. Backend middleware reloads the account to check activation and current role on each protected call.
- Native required/email validation, disabled controls, loading feedback, error alerts, visible focus indicators and reduced-motion styles support accessible interaction. There is no password-recovery link because password recovery is not implemented.

## Run locally

Use two PowerShell terminals from the repository root:

```powershell
cd backend
npm.cmd ci
npm.cmd run dev
```

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173/login`. Keep your existing `.env` files. The current local API port is 5001 and the frontend proxy points to it; fresh examples default to 5000. Atlas must be reachable and its Network Access allowlist must permit your current public IP. Admin accounts continue to be created using `backend/scripts/provision-admin.js`; there is no default administrator password or public admin registration.

## Verification commands

```powershell
cd backend
npm.cmd test
npm.cmd run test:db
npm.cmd run test:integration
cd ../frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
```

The browser suite needs installed Google Chrome and database network access. It starts separate servers on ports 5002 and 5174; keep those ports free. It uses the configured backend development database, creates uniquely named temporary accounts, a service and requests, and deletes only those records in cleanup. Do not run it concurrently with the integration suite, whose global count assertions assume no simultaneous writes. Screenshots are saved under ignored `frontend/test-results/`. Traces are disabled to avoid retaining login request payloads.

Verified on 15 October 2026: all 14 backend tests, the real MongoDB integration suite, frontend production build, ESLint and both Chrome browser tests passed. Browser coverage includes selection/link navigation, required fields, password visibility, invalid credentials, actual registration, both role-specific logins, request submission/tracking, refresh, logout, expired sessions, access restrictions, keyboard focus and desktop/tablet/mobile layout. Network failures, 503 responses and loading feedback were tested with intercepted login requests. No uncaught page errors occurred in the real login/request workflow. Screenshots are copied to `docs/screenshots/`.

Limits: password recovery remains unimplemented; JWT storage remains in localStorage as in the existing architecture. Real database disconnection during a browser session and a full mobile audit of every existing management screen were not exercised. Atlas connectivity succeeded during verification. `npm audit` also reports one existing high-severity transitive `source-map-js` advisory in the frontend development tooling; resolving that separate dependency issue is outside this login change.

## Files for this change

Created: `frontend/src/pages/PortalSelection.jsx`, `frontend/src/components/PortalIcon.jsx`, `frontend/src/styles/login.css`, `frontend/playwright.config.js`, `frontend/tests/login.spec.js`, and this document.

Modified: `frontend/src/pages/Login.jsx`, `frontend/src/pages/Register.jsx`, `frontend/src/App.jsx`, `frontend/src/auth/AuthProvider.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/admin/AdminLayout.jsx`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/.gitignore`, `backend/controllers/authController.js`, `backend/routes/RequestRoutes.js`, `backend/tests/security.test.js`, `backend/tests/integration.db.js`, `README.md`, `docs/TESTING.md` and `docs/screenshots/README.md`. Four actual login screenshots were added to `docs/screenshots/`.

Earlier backend-startup diagnostic changes in the working tree are retained.
