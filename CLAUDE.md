# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects, no root `package.json` or workspace tooling. Run commands from inside the relevant directory.

- `backend/` — NestJS 10 + Prisma 6 REST API on Neon PostgreSQL.
- `frontend/` — React 19 + Vite + React Router SPA (axios, lucide-react; plain CSS, no UI library).
- `TenantFlow_PROJECT_SPEC.md` — the full product spec and phased roadmap (Redis/BullMQ, rate limiting, RLS, notifications, Docker etc. are described there but **not yet implemented**). Check it before building a new feature.
- `CODEBASE_DOCUMENTATION.md` — file-by-file reference for the backend. Note it says the global prefix is `/api`; the real prefix is `/api/v1` (see `backend/src/main.ts`).

## Commands

Backend (`cd backend`):
```bash
cp .env.example .env          # set DATABASE_URL (pooled) + DIRECT_URL (direct, used by migrations), JWT secrets
npm install
npx prisma generate           # rerun after any schema.prisma change
npx prisma migrate deploy     # apply migrations
npx prisma migrate dev --name <name>   # create a new migration after editing schema.prisma
npm run dev                   # nest start --watch, http://localhost:3000/api/v1
npm run build && npm run start:prod
npm test                      # jest, picks up src/**/*.spec.ts
npx jest src/path/to/file.spec.ts      # single test file
npx jest -t "test name"                # single test by name
```
Swagger UI: `http://localhost:3000/api/docs`. Health: `GET /api/v1/health`.

Caveats: there are currently no `*.spec.ts` files and no `test/jest-e2e.json`, so `npm test` / `test:e2e` have nothing to run yet. `npm run lint` calls `eslint`, but eslint is not a dependency and there is no eslint config. Formatting is via `npm run format` (Prettier).

Frontend (`cd frontend`):
```bash
npm install
npm run dev       # Vite on :5173, proxies /api -> http://localhost:3000
npm run build     # tsc -b && vite build (this is the type-check)
npm run lint      # oxlint (.oxlintrc.json)
```
The API client uses `VITE_API_URL` or defaults to `http://localhost:3000/api/v1` directly (not through the Vite proxy); backend CORS is open (`app.enableCors()`).

## Backend architecture

**Multi-tenancy model:** shared database, shared schema. An `Organization` is a tenant. `Project`, `Task` and `AuditLog` carry a `tenantId` column (mapped to `tenant_id`). `Membership` joins `User` to `Organization` with a per-org `Role` (`OWNER | ADMIN | MANAGER | MEMBER | VIEWER`). Users are global; roles are per tenant.

**Request pipeline for tenant-scoped endpoints** — controllers apply guards in this exact order:
```ts
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
```
1. `JwtAuthGuard` (`auth/`) validates the Bearer access token and sets `request.user` (`{ userId, email, tenantId?, role? }`).
2. `TenantGuard` (`tenant/guards/tenant.guard.ts`) resolves the tenant id from, in priority order, the `x-tenant-id` header, the `:tenantId`/`:orgId` route param, or the `tenantId` JWT claim. It then **looks up the membership in the DB** and sets `request.tenant = { tenantId, role }`. The role used for authorization always comes from this DB lookup, never from the JWT.
3. `PermissionsGuard` reads `@RequirePermissions(Permission.X)` metadata and checks it against `ROLE_PERMISSIONS_MAP` (`permissions/role-permissions.map.ts`). `RolesGuard` + `@RequireRoles(...)` exist for role-based checks.

Controllers get the context with `@CurrentTenant() tenant: TenantContext` and pass `tenant.tenantId` as the first argument to the service.

**Tenant isolation rule (the main invariant):** every service query on a tenant-owned model must filter by `tenantId` as well as the id (`where: { id, tenantId }`), and use `findFirst` rather than `findUnique` by id alone. When a request references another entity (e.g. a task's `projectId` or `assigneeId`), the service must verify that entity belongs to the same tenant (assignee = has a membership in it). See `tasks/tasks.service.ts`. Never accept `tenantId` from a request body/query as trusted.

Adding a permission: add it to `permissions/permissions.enum.ts`, then grant it to roles in `role-permissions.map.ts`.

**Auth:** stateless JWTs signed with `JWT_SECRET` / `JWT_REFRESH_SECRET` (`auth/auth.service.ts`, bcrypt for passwords). Refresh tokens are not stored in the DB, so logout cannot actually revoke them. `POST /organizations/:id/switch` issues a new token pair with `tenantId` and `role` claims for that org.

**Cross-cutting:**
- `PrismaModule` and `AuditModule` are global; inject `PrismaService` / `AuditService` anywhere without importing their modules.
- `AuditService.logAction(tenantId, userId, action, entity, entityId, metadata?)` exists but is not yet called from any feature service.
- Global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted` + implicit conversion: every request field must be declared on a `class-validator` DTO or the request is rejected with 400.
- `common/filters/http-exception.filter.ts` formats all errors as `{ statusCode, message, error, timestamp, path }`.
- List endpoints return `{ data, meta: { total, page, limit, totalPages } }` with `page`/`limit` query params.
- Prisma models use camelCase fields mapped to snake_case columns/tables via `@map` / `@@map`; follow that for new models and index tenant-scoped models on `tenantId` (plus composite indexes for common filters).

Feature modules follow the Nest convention `x.module.ts / x.controller.ts / x.service.ts / dto/` and are registered in `app.module.ts`. Controllers are annotated with `@nestjs/swagger` decorators (`@ApiTags`, `@ApiBearerAuth`, `@ApiHeader('x-tenant-id')`, `@ApiOperation`, `@ApiResponse`).

## Frontend architecture

- `src/api/apiClient.ts` is the single axios instance. A request interceptor adds `Authorization: Bearer <access>` and `x-tenant-id` from `localStorage`; a response interceptor handles 401 by calling `/auth/refresh` once, queueing concurrent requests, and redirecting to `/login` on failure. Per-resource API wrappers live alongside it (`api/projects.ts`, `api/tasks.ts`, …).
- `localStorage` keys: `tenantflow_access_token`, `tenantflow_refresh_token`, `tenantflow_active_tenant_id`.
- `src/context/AuthContext.tsx` owns the user, the list of orgs, and `activeTenant`; `switchTenant(orgId)` calls the backend switch endpoint and stores the new tokens. Server state is fetched in pages directly (no React Query).
- Routing is in `App.tsx` with `ProtectedRoute` / `PublicRoute` wrappers; authenticated pages render inside `components/layout/AppLayout.tsx`.
- Shared types in `src/types/index.ts` mirror the backend DTOs/enums by hand; keep them in sync when changing backend contracts.
