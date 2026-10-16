# Frontend design and themes - 16 October 2026

## Scope and result

Inspected the existing React entry point, router, authentication provider, both login portals, shared components, service pages, admin layout, shared styles and browser tests before editing. This is a frontend update to the existing application. Backend APIs, schemas, role permissions and environment files were not changed.

- Hero uses the exact heading **Connecting Students to University Services.** and the requested supporting text. Explore Services and Sign In retain existing routes.
- Original, locally bundled architectural campus illustration replaces the earlier cartoon. It is a generic illustration, not an official university campus photograph.
- Inter is hosted locally, with its SIL Open Font License included. The font is preloaded and falls back to system fonts while loading.
- University Services, Appointments, Student Support and Request Tracking cards use Lucide icons and existing working routes. Lucide React is the only new runtime dependency.
- Shared semantic color tokens cover backgrounds, panels, typography, fields, tables, status/error/success notices, charts and dialogs. Spacing, text sizes, borders, hover/focus effects, navigation and footer were refined within the navy/blue identity.
- Sun/moon buttons appear in the public/student navigation, both authentication headers, portal selection and admin top bar. The choice is saved under `university-theme` in localStorage. Without a saved choice, system preference is used and live changes are respected. Storage failures retain a usable in-memory toggle.
- A small pre-render script applies the theme before paint. Theme changes synchronize between mounted controls and tabs. Reduced-motion preferences disable transitions.
- Separate student/admin entry points, student-only registration and all existing authentication and service workflows remain in place.

## Verification actually run

- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run test:ui`: 7 Chrome tests passed. Covers exact hero copy/image loading, 1440/768/390px layouts, portal navigation, booking and complaint controls, missing-staff guidance, theme persistence/system preference, public pages, dark student/admin dashboards/charts/dialogs, blocked storage and reduced motion. API responses in this suite are explicit fixtures.
- `npm.cmd run test:e2e`: 3 Chrome tests passed against the configured MongoDB backend. Covers real student/admin registration/login, role boundaries, requests, authentication error states, availability/booking/approval, complaint resolution and notification read persistence. Temporary test records were cleaned.
- `git diff --check`: passed.
- Visually inspected light desktop homepage, dark mobile homepage and dark mobile admin dashboard screenshots. Screenshots are generated under ignored `frontend/test-results/`.

No known redesign regression remains. Broader browser/device coverage and screen-reader acceptance remain manual. If localStorage is blocked, persistence across full reloads is unavailable and the system theme is used at startup.

## Assets and attribution

- `frontend/src/assets/campus-architecture.svg`: original architectural illustration, no external image service.
- Inter: official Inter project (`https://github.com/rsms/inter`), self-hosted WOFF2 with `frontend/public/fonts/Inter-LICENSE.txt`.
- Icons: Lucide React; package license ships with the dependency.

## Files changed

- `docs/TESTING.md`
- `docs/UI-REDESIGN.md`
- `frontend/index.html`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/public/fonts/Inter-LICENSE.txt`
- `frontend/public/fonts/InterVariable.woff2`
- `frontend/src/admin/AdminDashboard.jsx`
- `frontend/src/admin/AdminLayout.jsx`
- `frontend/src/admin/admin.css`
- `frontend/src/admin/shared.css`
- `frontend/src/assets/campus-architecture.svg`
- `frontend/src/components/Icon.jsx`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/PortalIcon.jsx`
- `frontend/src/components/ThemeToggle.jsx`
- `frontend/src/main.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/PortalSelection.jsx`
- `frontend/src/pages/Services.jsx`
- `frontend/src/styles/global.css`
- `frontend/src/styles/login.css`
- `frontend/src/styles/theme.css`
- `frontend/src/theme.js`
- `frontend/tests/support.ui.spec.js`
