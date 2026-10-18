# University Service System

An existing React/Vite student portal extended with a secure Express/MongoDB administration portal. Existing requests and accounts are retained. Every dashboard count and activity row comes from the database.

## Features

- Admin assigns and monitors complaints; staff investigate only their assigned complaints, with student-owned tracking and private internal notes. See [complaint assignment and privacy](docs/COMPLAINT-ASSIGNMENT.md).

- Staff publish and manage service appointment availability, locations and capacity; students discover, book and cancel appointments. See [availability workflow, permissions and transaction requirements](docs/APPOINTMENT-AVAILABILITY.md).

- Staff and lecturers register with name, email, required Staff ID and password, await Admin approval, then process only service requests assigned to them by an administrator. See [staff workflow, API, existing-account handling and verification](docs/STAFF-WORKFLOW.md).
- Students register, sign in, browse active university services, submit normal or urgent requests, and track status and staff comments.
- `/` retains the original campus homepage. Its Sign In link opens `/login`, with the unified Student, Staff / Lecturer, and Admin role switcher. Existing role-specific login URLs preselect the role. Backend account permissions and staff approval checks are preserved. See [login details](docs/LOGIN.md).
- Administrators sign in at `/admin/login` and manage dashboard metrics, requests, accounts, roles and services.
- Dashboard includes student/staff counts, all five request statuses, recent requests and six monthly request totals.
- Admin tables include search, filters, sorting, pagination, loading/error/empty states and retry controls.
- Request details include full ID, student details, description, priority, dates, staff assignment and comments. Updates require confirmation; concurrent edits are rejected.
- Services support create, read, edit and safe delete (deactivation). Inactive services remain editable and can be reactivated.
- Accounts support create, details, edit, role changes, deactivation and reactivation. Existing administrators cannot be demoted or deactivated through this portal.

## Stack and prerequisites

Node.js **24 LTS** (verified with 24.11.1), npm, React 19, Vite 8, React Router, Axios, Express 5, MongoDB/Mongoose 9, JWT and bcryptjs. No new runtime UI or chart dependencies were added.

Use a local MongoDB instance or an Atlas database whose network access rules permit your machine. Development requires two terminals. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`; do not change the system policy.

## Setup

From the repository root:

```powershell
cd backend
npm.cmd ci
Copy-Item .env.example .env
cd ../frontend
npm.cmd ci
Copy-Item .env.example .env
```

Do not overwrite an existing configured `.env`. Edit `backend/.env`:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/university_service_system
JWT_SECRET=replace-with-a-cryptographically-random-secret
FRONTEND_ORIGIN=http://localhost:5173
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and put the result only in the backend environment. The server requires at least 32 characters. Never commit real secrets, database credentials or admin passwords. A short local secret was rotated during this implementation; previous sessions need to sign in again.

The frontend defaults to `/api`. Vite proxies it to `http://127.0.0.1:5000`. For separate production hosting, set `VITE_API_BASE_URL=https://your-api.example/api`; this value is public and must contain no secrets. Serve the SPA with a fallback to `index.html` for routes such as `/admin/requests`. If using same-origin production hosting, reverse-proxy `/api` to Express. Use HTTPS in production. `FRONTEND_ORIGIN` should be the exact frontend origin.

### Initial administrator

The configured local backend uses **port 5001** because an older server already occupied port 5000. `backend/.env` has `PORT=5001`; `frontend/.env` has `API_PROXY_TARGET=http://127.0.0.1:5001`. Both files are ignored by Git. The old process was left running. To use another port, update both values and restart the development servers. Fresh example configurations default to port 5000.

There is **no public admin-registration endpoint**. Provision a new administrator from a trusted backend terminal:

```powershell
cd backend
$env:ADMIN_NAME = 'University Administrator'
$env:ADMIN_EMAIL = 'admin@your-university.example'
$adminSecurePassword = Read-Host 'Enter a unique admin password' -AsSecureString
$adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecurePassword)
try {
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
    npm.cmd run provision:admin
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer)
    Remove-Item Env:ADMIN_PASSWORD
}
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_NAME
```

This works in Windows PowerShell 5 and PowerShell 7. Enter the password through the masked prompt; it is temporarily passed to the provisioning process and then removed. Never type real passwords into commands saved in shell history.

Password rules: at least eight characters, at most 72 UTF-8 bytes (bcrypt's limit). The provisioning command refuses to overwrite or promote an existing account. Use a new email address. Sign in at `/admin/login`. Additional staff/student/admin accounts can then be created by an authenticated administrator. There is no default or hardcoded admin password.

Existing administrators are intentionally immutable in role/activation through the portal, preventing last-admin loss even during concurrent updates. Exceptional admin removal requires a separately reviewed database maintenance procedure.

### Service catalogue

The original six services were displayed as frontend constants. They are now persistent Service records. Import any missing entries without overwriting existing records:

```powershell
cd backend
npm.cmd run import:catalogue
```

Department labels are Registry, Student Services and Library and can be edited in the admin portal. Processing time is optional and is not invented by the import. Re-running does not change existing/inactive services.

### Run

Recommended: double-click `Start-University-System.cmd`, or run this from the repository root:

```powershell
npm.cmd start
```

This starts the API first, waits for MongoDB to connect, then starts the website at `http://localhost:5173`. It automatically uses the backend's configured port for the frontend proxy. Keep the terminal open while using the app; Ctrl+C stops both servers. After restarting your computer or closing the terminal, run the launcher again before reopening the website. A browser bookmark alone does not start these local servers. If dependencies are missing, run `npm.cmd run setup` once.

The frontend uses a fixed port and reports a conflict instead of silently changing the website address. The launcher uses `/api` for local development. The frontend preview also proxies `/api` to `API_PROXY_TARGET`; deployed hosting still requires the API configuration described above.

You can also run `npm.cmd run dev` from `frontend` alone: Vite reads the backend port, starts the local API automatically if needed, and waits for MongoDB before serving the website. It reuses an already running API and stops an API it started when Vite closes. An explicit remote `API_PROXY_TARGET` remains externally managed.

Alternatively, start each server separately:

Backend terminal:

```powershell
cd backend
npm.cmd run dev
```

Frontend terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:5173`. For a frontend production build, run `npm.cmd run build`; `npm.cmd run preview` also starts the local API when needed. A deployed site requires an always-running hosted backend and an accessible MongoDB database; a browser bookmark cannot start local programs after the computer restarts.

### Backend startup or login fails

The API connects to MongoDB before listening, so login cannot work while startup is failing. From `backend`, run `npm.cmd run test:db` to isolate the database connection. A `querySrv`/`queryTxt` error indicates a DNS lookup failure: check the network/DNS and the Atlas cluster address. A server-selection failure can indicate blocked database traffic, an unavailable cluster, or an Atlas Network Access IP allowlist that does not include your current public IP. Authentication failures require checking the Atlas database user credentials in `MONGO_URI`. Keep credentials private.

After connectivity is restored, restart `npm.cmd run dev`. Confirm the terminal reports `MongoDB connected`, and that `frontend/.env`'s `API_PROXY_TARGET` matches the backend port. Restart Vite after changing its environment. Restricted execution environments may block Atlas connections even when the same command succeeds in a normal terminal.

## API

All responses are JSON. Errors return `{ "message": "..." }`. Lists return `{ items, total, page, pages }`. Protected calls use `Authorization: Bearer <token>`. Tokens expire after eight hours. The server reloads the user from MongoDB for each protected request; stale role claims do not grant access.

| Method     | Endpoint                       | Access / purpose                                            |
| ---------- | ------------------------------ | ----------------------------------------------------------- |
| POST       | /api/auth/register             | Public; always creates a student                            |
| POST       | /api/auth/login                | Public; returns token and safe user details                 |
| GET        | /api/auth/me                   | Signed-in account details                                   |
| GET        | /api/services                  | Public active catalogue                                     |
| POST       | /api/requests                  | Student; create an owned request                            |
| GET        | /api/requests/my               | Student; only their requests                               |
| GET        | /api/admin/dashboard           | Admin; real counts, recent requests, trends                 |
| GET        | /api/admin/requests            | Admin; searchable paginated requests                        |
| GET        | /api/admin/requests/:id        | Admin; details and allowed status transitions               |
| PATCH      | /api/admin/requests/:id        | Admin; status, assignment, staff comments                   |
| PATCH      | /api/admin/requests/:id/status | Same validation and controller as above                     |
| GET, POST  | /api/admin/users               | Admin; list / create account                                |
| GET, PATCH | /api/admin/users/:id           | Admin; details / whitelisted profile and activation changes |
| PATCH      | /api/admin/users/:id/role      | Admin; validated permission change                          |
| DELETE     | /api/admin/users/:id           | Admin; safely deactivate non-admin                          |
| GET        | /api/admin/staff               | Admin; active staff assignment options                      |
| GET, POST  | /api/admin/services            | Admin; list / create service                                |
| GET, PATCH | /api/admin/services/:id        | Admin; details / edit                                       |
| DELETE     | /api/admin/services/:id        | Admin; safely deactivate service                            |

List parameters: `q`, `page` (default 1), `limit` (default 10, max 100), `sort`, `order=asc|desc`. Allowed sort fields are explicit per controller.

- Requests: `status`, `priority`, exact `service`, `from` / `to` (valid YYYY-MM-DD, UTC inclusive dates); sorts createdAt, updatedAt, service, status, priority. Search full MongoDB request ID, service, student name/email or student ID.
- Users: `role`, `active=true|false`; sorts createdAt, updatedAt, name, email, role.
- Services: `active=true|false`; sorts createdAt, updatedAt, name, department.

Request creation accepts `serviceId`, `studentId`, `description`, optional `priority`. Historical links using a service name also work for an active service. Client-supplied status/ownership fields are rejected.

Request updates accept `status`, `expectedStatus`, `assignedStaff` (active staff ID or null), and `staffComment`. Include the last observed `expectedStatus` whenever setting status. Updates also condition on the record's last updated timestamp to reject conflicting writes.

| Current status | Allowed next statuses          |
| -------------- | ------------------------------ |
| Pending        | Processing, Approved, Rejected |
| Processing     | Approved, Rejected, Completed  |
| Approved       | Processing, Completed          |
| Rejected       | None                           |
| Completed      | None                           |

Final requests still permit assignment/comment maintenance. All changes are confirmed in the UI.

Services accept name (120 chars), description (2000), department (120), optional processingTime (120) and active (boolean). Names are checked case-insensitively. New/edited names also use a unique sparse normalized `nameKey` index. Existing names are checked without requiring a destructive migration.

User profile updates accept name, email, phone, studentId and active; role has a separate endpoint. Passwords are never returned by admin lists/details. Public registration ignores supplied roles and activation fields. Most management writes reject unsupported properties, invalid IDs and invalid enums. HTTP 400/401/403/404/409/429/500/503 distinguish bad input, authentication, permissions, missing records, conflicts, throttling and availability.

## Database design

See [database design and ER diagram](docs/DATABASE.md). Existing collection/model names are retained:

- User: identity/contact fields, studentId, bcrypt password, student/staff/admin role, active flag, timestamps. Email unique; optional studentId unique/sparse. Password is excluded by default.
- Service: name, description, department, optional processingTime, active, timestamps; internal normalized nameKey.
- Request: student reference, service name snapshot, optional serviceRef, studentId, description, priority, existing five-state status, optional assignedStaff reference, staffComment, document reference and timestamps.
- Appointment, Complaint and Notification models are retained; no new screens or API functionality is claimed for them.

Legacy users without an active field are treated as active. Existing requests without serviceRef remain readable. No historical names, descriptions or IDs are rewritten. Request indexes support status/date, student/date and serviceRef access. Safe-delete actions preserve all history; they do not physically erase records.

## Verification

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:e2e
cd ../backend
npm.cmd test
npm.cmd run test:db
npm.cmd run test:integration
```

`npm test` uses Node's built-in test runner for 14 security, validation and startup-diagnostic tests. It needs no live MongoDB. `test:integration` connects to the configured MongoDB, creates uniquely named Integration-* accounts/service/request, tests actual persistence, and removes **only the created IDs** in a finally block. It never resets a collection. Prefer a development database; do not run it during concurrent demonstrations because temporary test records briefly appear in global counts. The frontend's `test:e2e` command uses installed Chrome and the configured database; see [browser test prerequisites](docs/LOGIN.md). Run the integration and browser suites separately.

Verified: frontend build and lint; 14 backend tests; real MongoDB integration suite for authentication, portal role checks, service create/read/update/deactivate/reactivate, status persistence, assignment/comments, user role/activation, metrics and search/filter/sort/pagination. Chrome browser tests cover separate login forms, registration, request submission/tracking, refresh, logout, session expiry, access restrictions and error handling. See [test results and manual checklist](docs/TESTING.md).

## Interface screenshots

Actual Chrome screenshots of the login selection and mobile forms are in [docs/screenshots](docs/screenshots/README.md). Dashboard, request detail, user-management and service-management screenshots remain on the manual capture checklist.

## Evaluation and demonstration

[Implementation walkthrough](docs/IMPLEMENTATION.md) explains major files and the logic to review. [Report outline and five-minute demonstration](docs/EVALUATION.md) maps the supplied criteria to working features. The actual rubric PDF was not attached, so its contents, maximum report layout and any additional EC4307 academic-integrity clauses could not be independently verified. The checklist follows the criteria in the pasted request; it makes no marks guarantee.

Review and understand the code yourself. Complete the browser/mobile checklist and record your own demonstration. There is no reset-password/email-verification feature, file-upload pipeline, durable audit log, or distributed login limiter in this scope. Existing document references are displayed as text. The JWT remains in localStorage as in the existing application; production deployment should enforce HTTPS, a strict content security policy, and consider an HttpOnly-cookie session design.
