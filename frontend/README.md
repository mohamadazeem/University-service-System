# University Service System frontend

The React/Vite student and admin portals share the existing Express/MongoDB backend.

See the repository [README](../README.md) for installation, environment variables, secure admin provisioning, endpoints and testing.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

Default API base: `/api`, proxied to port 5000 during Vite development. Set `VITE_API_BASE_URL` for a separate production API. Do not put secrets in frontend environment variables.

Admin paths: `/admin/login`, `/admin`, `/admin/requests`, `/admin/users`, `/admin/services`. Protected routes verify the account through `/api/auth/me`; every admin API is also protected on the server.
