# Implementation walkthrough

## Phase 1: inspect

The original project contained student registration/login, request creation/history, basic pages and six Mongoose models. It had no admin API/UI or persistent service catalogue; the student dashboard showed fixed activity and totals. Registration accepted client roles; authorization relied on JWT role claims. The attached request was read in full. The rubric PDF was absent. Existing frontend build/lint passed.

## Phase 2: secure

- backend/controllers/authController.js validates email/password/identity fields, hashes passwords and always creates students through public registration. Login returns an eight-hour JWT and safe profile fields.
- backend/middleware/authMiddleware.js verifies HS256 tokens, then reloads the account from MongoDB. Current role and active status govern authorization; old token roles cannot bypass a demotion.
- Existing roleMiddleware.js continues to enforce admin/student route permissions.
- models/user.js adds a backwards-compatible active flag and hides password by default.
- scripts/provision-admin.js creates a new admin only from a trusted command-line environment. It cannot overwrite an existing account.
- utils/validation.js centralizes IDs, strings, enums, booleans, body allowlists, escaped search and pagination. errorMiddleware.js sends safe HTTP errors.
- loginLimiter.js limits public authentication attempts per IP in this single-server application.
- app.js separates Express configuration from startup so HTTP tests can run without a database. server.js requires valid environment configuration and waits for MongoDB before listening.

Ten security tests passed, including public role escalation, expired tokens, unauthorized reads/writes, mass assignment and self/last-admin protection.

## Phase 3: build

- controllers/adminDashboardController.js queries real counts, grouped request statuses, recent rows and six UTC monthly totals.
- adminRequestController.js filters/sorts/pages requests, populates safe student/staff fields and validates status transitions. Updates condition on the last status/timestamp to reject concurrent changes.
- adminUserController.js manages accounts and permissions. Existing admin roles/deactivation are protected even if two administrators edit concurrently.
- serviceController.js implements validated persistent CRUD, duplicate checks and reversible safe deletion.
- routes/adminRoutes.js applies JWT and admin authorization to every route before dispatching its controller.
- Request.serviceRef is an optional reference alongside the retained historical service-name string. No existing request requires migration.
- scripts/import-catalogue.js preserves the six previously advertised student services as MongoDB records, without overwriting existing entries.

Frontend:

- src/api/client.js supplies one Axios base URL, Bearer header, timeout and expired-session handling.
- src/auth/AuthProvider.jsx verifies startup sessions with the backend; components/ProtectedRoute.jsx gates authenticated/admin/student routes.
- src/admin/AdminLayout.jsx provides sidebar navigation, collapse/mobile controls, page title, profile menu and logout.
- AdminDashboard.jsx presents live cards, an accessible CSS status chart, monthly bars and recent requests.
- AdminRequests.jsx uses full request details, staff assignment, comments, allowed status choices and a confirmation step.
- AdminUsers.jsx uses account forms, detail dialogs, role confirmations, activation controls and paginated filters.
- AdminServices.jsx uses validated create/edit forms, full details and confirmed deactivation.
- components/Modal.jsx restores focus, traps Tab, handles Escape and locks background scrolling.
- hooks/useResource.js cancels outdated reads and supplies loading, retry and error states.
- admin/shared.css and admin/admin.css provide the navy/light responsive system without adding chart/UI packages.
- Student Dashboard, Services, RequestService and MyRequests now read the same real backend. Existing student paths remain available.

## Phase 4: validate

Build/lint and real MongoDB integration tests passed. The integration suite creates uniquely named temporary records, checks actual persisted changes and cleans only its own IDs. Existing accounts and requests are not modified.

Browser tools exposed no available browser, so visual inspection, responsive interaction testing and screenshots remain on the manual checklist. CSS breakpoints and accessibility behavior are implemented but visual correctness is not claimed as verified.

## Phase 5: document

The root README covers setup, environment variables, provisioning, catalogue import, startup, endpoint contracts, security and test commands. DATABASE.md includes the ER diagram. TESTING.md records measured results and remaining manual checks. EVALUATION.md supplies an outline and short demonstration guide based on the pasted criteria.

Explain these three ideas during evaluation: server authorization uses current database roles; safe deletion preserves references; historical service names remain separate from current service records. Read the controllers and run the tests yourself before presenting.
