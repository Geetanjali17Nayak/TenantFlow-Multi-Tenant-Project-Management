---
description: Create a feature spec (backend + frontend) from a feature number and name
argument-hint: <feature-number> <feature name>
---

Create a feature specification document for TenantFlow.

Arguments: `$ARGUMENTS`

## 1. Parse the arguments

- The first token is the **feature number**. Zero-pad it to 3 digits (`7` -> `007`).
- Everything after it is the **feature name**. Build a kebab-case slug from it (lowercase, spaces/underscores -> `-`, strip anything that isn't `a-z0-9-`).
- If either part is missing, stop and ask for it. Usage: `/create-spec 7 audit log export`.

Target file: `specs/<NNN>-<slug>.md` at the repository root. Create `specs/` if it doesn't exist. If the file already exists, stop and ask whether to overwrite it.

## 2. Gather context before writing

Read only what is relevant to the feature:
- `CLAUDE.md` (architecture, tenant isolation invariant, guard order, frontend API client).
- `TenantFlow_PROJECT_SPEC.md`: search it for sections that mention this feature and use them as the source of truth for scope.
- Backend: `backend/prisma/schema.prisma`, the closest existing module (e.g. `backend/src/tasks/`, `backend/src/projects/`), `backend/src/permissions/permissions.enum.ts`, `backend/src/permissions/role-permissions.map.ts`.
- Frontend: `frontend/src/App.tsx`, `frontend/src/types/index.ts`, `frontend/src/api/apiClient.ts` and the closest wrapper (e.g. `frontend/src/api/tasks.ts`), the closest page (e.g. `frontend/src/pages/ProjectsPage.tsx`), and `frontend/src/components/common/`.
- Existing files in `specs/` so numbering and style stay consistent.

Do not write any application code. This command only produces the spec.

## 3. Write the spec with this structure

```markdown
# <NNN> — <Feature Name>

- **Status:** Draft
- **Feature #:** <NNN>
- **Created:** <today's date, YYYY-MM-DD>
- **Related:** <sections of TenantFlow_PROJECT_SPEC.md>

## 1. Summary
One paragraph: what this feature does and why.

## 2. Goals / Non-goals

## 3. User stories
"As a <role: OWNER|ADMIN|MANAGER|MEMBER|VIEWER>, I want … so that …"

## 4. Functional requirements
Numbered FR-1, FR-2, … each testable.

## 5. Backend (NestJS + Prisma)

### 5.1 Data model
New/changed Prisma models as a `prisma` code block: camelCase fields with `@map`/`@@map` to snake_case, `tenantId` + `@@index([tenantId])` on tenant-owned models, composite indexes for common filters, relations, cascades, enums. Migration: `npx prisma migrate dev --name <slug>`.

### 5.2 API
Table: Method | Path (under `/api/v1`) | Permission | Description. For each endpoint: request DTO (class-validator, every field declared), response shape (lists return `{ data, meta: { total, page, limit, totalPages } }`), error cases with status codes.

### 5.3 Authorization & tenant isolation
`@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`; new `Permission` values and role grants in `ROLE_PERMISSIONS_MAP`; every query uses `findFirst` with `{ id, tenantId }`; referenced entities verified to be in the same tenant; `tenantId` never taken from body/query.

### 5.4 Audit logging
Which actions call `AuditService.logAction(...)`.

### 5.5 Files
Module/controller/service/dto files, `app.module.ts` registration, Swagger decorators.

## 6. Frontend (React + Vite)

### 6.1 Routes & navigation
Routes in `App.tsx` (`ProtectedRoute`, inside `AppLayout`), sidebar entries.

### 6.2 Pages & components
File paths, responsibility, props, state, short wireframe. Reuse `Modal`, `Badge`, etc.

### 6.3 UI states
Loading, empty, error, success, permission-denied.

### 6.4 Role-based UI
What each role sees or can do (backend stays the authority).

### 6.5 API integration & types
Wrapper functions in `src/api/<feature>.ts` via `apiClient`; additions to `src/types/index.ts` mirroring backend DTOs; refetch after mutations and on tenant switch.

### 6.6 Forms & validation
Fields, client rules matching backend validation, how 400 errors display.

## 7. Edge cases

## 8. Testing plan
Backend Jest unit tests (`*.spec.ts`) incl. a cross-tenant access test that must fail; frontend manual steps; `npm run build` and `npm run lint` must pass.

## 9. Acceptance criteria
Checklist (`- [ ]`) a reviewer can verify.

## 10. Open questions
```

Fill every section with concrete content for this feature, not placeholders. If the feature is backend-only or frontend-only, keep the other section and say "No changes" with a reason.

## 4. Finish

Print the path of the created file and a 3-5 line summary (endpoints, models, pages). Do not run git commands.
