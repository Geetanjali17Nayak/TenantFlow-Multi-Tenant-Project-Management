# 002 — Activity Log: Technical Plan

- **Spec:** [`specs/002-activity-log.md`](./002-activity-log.md)
- **Created:** 2026-10-26
- **Status:** Ready to implement
- **Estimated effort:** ~1.5–2 days (backend ~5h, frontend ~5h, tests + verification ~3h)

This plan turns the spec into ordered, independently verifiable steps. Backend lands first: logging is wired in before the read endpoint, so by the time `GET /activity` exists there is real data to look at. Each step ends with a check you can run before moving on.

---

## 0. Decisions assumed for the spec's open questions

The plan uses these defaults so work can start now. Changing any of them affects only the step noted.

| # | Open question | Default in this plan | Step affected if changed |
|---|---|---|---|
| 1 | `LOGIN` / `LOGOUT` events | **Skip** (no tenant at login; same call as 001) | — (would need `tenantId` nullable in B1) |
| 2 | `ORGANIZATION_UPDATED` | **Defer** to an org-settings feature; keeps scope to tasks/projects/members | B6 (one more `logAction` call) |
| 3 | Project filter for task events | **Defer**; no `project_id` column. `projectId` stays in metadata so it can be backfilled later | B1, B7 |
| 4 | Audit failure blocks the change? | **Yes, atomic**: audit row written inside the same `$transaction` | B3–B6 |
| 5 | Fix `PaginatedResult` everywhere | **Only audit + activity here**; add `Paginated<T>` and leave `PaginatedResult` for the other pages. Follow-up: migrate `ProjectsPage` etc. | F1, F6 |
| 6 | VIEWERs see member/role changes | **Yes** (they already have `MEMBER_READ`) | B7 (would filter `entity: 'Member'` by role) |
| 7 | Retention | **Keep forever**; no job, no TTL | — |

---

## 1. Context that shapes the implementation

Checked in the current code:

- `AuditModule` is `@Global()` and exports `AuditService`, so `TasksService`, `ProjectsService` and `OrganizationsService` can inject it without changing their modules' `imports`.
- `AuditService.logAction` exists but has zero callers, and uses `this.prisma` directly, so it can't join a transaction yet. Adding an optional `tx` parameter is the only change it needs.
- `AuditController` already serves `GET /audit-logs` (`AUDIT_READ`, OWNER/ADMIN). The new endpoint goes in a **separate** `ActivityController` in the same module, so the raw view stays untouched.
- `TenantContext` is only `{ tenantId, role }`. `TasksController` and `ProjectsController` don't receive the user id today, so each mutation handler gains `@CurrentUser('userId')` (from `common/decorators/current-user.decorator.ts`, already used by `OrganizationsController` and `UsersController`).
- Organization member endpoints use `JwtAuthGuard` only and take `orgId` from `:id`. The service checks membership itself (`verifyMembership` / `verifyMembershipRole`), so `orgId` is a trustworthy `tenantId` **after** those calls.
- `TasksService.updateTask` and `deleteTask` already load the row through `getTaskById` (`findFirst { id, tenantId }`, includes `project` and `assignee`). That result is the "before" snapshot for the diff; no extra query.
- `ProjectsService.getProjectById` already includes `_count.tasks`, which gives `taskCount` for `PROJECT_DELETED` for free.
- `updateMemberRole` and `removeMember` load the target with `findFirst` but without `user`. Add `include: { user: { select: { name: true, email: true } } }` to that same query.
- Backend list responses are `{ data, meta }`, but the frontend `PaginatedResult<T>` is flat, so `AuditLogsPage` always reads `totalPages` as `undefined`. Fixed for audit in F6.
- `AppLayout` renders `navItems` for every role with no filtering; the "Audit Trail" link currently 403s for MANAGER/MEMBER/VIEWER.
- Reusable frontend pieces already exist: `components/common/Avatar.tsx` (handles broken images), `utils/apiError.ts` (`getApiErrorMessages`), `Badge.tsx`, `Modal.tsx`.
- `users.service.spec.ts` and `users.dto.spec.ts` exist from feature 001 and show the Jest + mocked `PrismaService` pattern. No new dependencies are needed on either side.

---

## 2. Backend steps

### B1. Indexes + migration

**File:** `backend/prisma/schema.prisma`, `model AuditLog`, next to the existing `@@index([tenantId, createdAt])`:

```prisma
@@index([tenantId, entity, entityId, createdAt])
@@index([tenantId, userId, createdAt])
```

**Commands** (from `backend/`):

```bash
npx prisma migrate dev --name activity-log
npx prisma generate
```

Expected: `prisma/migrations/<timestamp>_activity_log/migration.sql` with two `CREATE INDEX` statements and nothing else.

**Check:** `npm run build` passes.

> Note: `migrate dev` runs against `DIRECT_URL` in `backend/.env`. Point it at a Neon dev branch, not production. Index-only, so it is safe on existing rows.

### B2. Constants, diff helpers, and `logAction(tx?)`

**New file:** `backend/src/audit/audit.constants.ts`

```ts
export enum AuditAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  PROJECT_DELETED = 'PROJECT_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  ROLE_CHANGED = 'ROLE_CHANGED',
}

export enum AuditEntity {
  TASK = 'Task',
  PROJECT = 'Project',
  MEMBER = 'Member',
}

export type FieldChange<T = unknown> = { from: T; to: T };
export type AuditChanges = Record<string, FieldChange | { changed: true }>;
```

**New file:** `backend/src/audit/audit-diff.ts` — pure functions, no Nest/Prisma imports:

```ts
type TaskSnapshot = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assignee?: { name: string } | null;
};

export function diffTask(before: TaskSnapshot, after: TaskSnapshot): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of ['title', 'status', 'priority'] as const) {
    if (before[field] !== after[field]) changes[field] = { from: before[field], to: after[field] };
  }
  if (before.assigneeId !== after.assigneeId) {
    changes.assigneeId = { from: before.assigneeId, to: after.assigneeId };
    changes.assigneeName = { from: before.assignee?.name ?? null, to: after.assignee?.name ?? null };
  }
  if ((before.description ?? null) !== (after.description ?? null)) changes.description = { changed: true };
  return changes;
}

export function diffProject(
  before: { name: string; description: string | null },
  after: { name: string; description: string | null },
): AuditChanges { /* name → { from, to }; description → { changed: true } */ }
```

**File:** `backend/src/audit/audit.service.ts` — change `logAction`:

```ts
async logAction(
  tenantId: string,
  userId: string | null,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  metadata?: Record<string, any>,
  tx?: Prisma.TransactionClient,
) {
  return (tx ?? this.prisma).auditLog.create({
    data: { tenantId, userId, action, entity, entityId, metadata: metadata || undefined },
  });
}
```

`Prisma` comes from `@prisma/client`. There are no existing callers, so tightening `action`/`entity` to the enums breaks nothing.

**Check:** `npm run build`; `npx jest src/audit/audit-diff.spec.ts` (written in §4).

### B3. Tasks

**File:** `backend/src/tasks/tasks.service.ts`

- Constructor: `private readonly auditService: AuditService`.
- Signatures gain `userId` as the second argument: `createTask(tenantId, userId, projectId, dto)`, `updateTask(tenantId, userId, taskId, dto)`, `deleteTask(tenantId, userId, taskId)`. Read methods are unchanged.
- Keep the existing validation (project in tenant, assignee membership) **outside** the transaction; only the write + log go inside.

```ts
// createTask
return this.prisma.$transaction(async (tx) => {
  const task = await tx.task.create({ data: { /* as today */ }, include: { /* as today */ } });
  await this.auditService.logAction(tenantId, userId, AuditAction.TASK_CREATED, AuditEntity.TASK, task.id, {
    title: task.title,
    projectId: task.projectId,
    projectName: task.project.name,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.name ?? null,
  }, tx);
  return task;
});

// updateTask
const before = await this.getTaskById(tenantId, taskId);
// ...existing assignee check...
return this.prisma.$transaction(async (tx) => {
  const updated = await tx.task.update({ /* as today */ });
  const changes = diffTask(before, updated);
  if (Object.keys(changes).length > 0) {
    await this.auditService.logAction(tenantId, userId, AuditAction.TASK_UPDATED, AuditEntity.TASK, taskId,
      { title: updated.title, projectId: updated.projectId, projectName: updated.project.name, changes }, tx);
  }
  return updated;
});

// deleteTask
const task = await this.getTaskById(tenantId, taskId);
await this.prisma.$transaction(async (tx) => {
  await tx.task.delete({ where: { id: taskId } });
  await this.auditService.logAction(tenantId, userId, AuditAction.TASK_DELETED, AuditEntity.TASK, taskId,
    { title: task.title, projectId: task.projectId, projectName: task.project?.name }, tx);
});
return { message: 'Task successfully deleted' };
```

**File:** `backend/src/tasks/tasks.controller.ts` — on the three mutation handlers add `@CurrentUser('userId') userId: string` and pass it through. Request/response shapes do not change.

Gotcha: the existing update uses `...(dto.title && { title })` and `...(dto.status && ...)`; leave that as is. The diff compares the real before/after rows, so it stays correct whatever the spread logic does.

**Check:** `npm run dev`, create/update/delete a task in Swagger, then `GET /audit-logs` as an OWNER shows three rows with the right `userId`.

### B4. Projects

**File:** `backend/src/projects/projects.service.ts` + `projects.controller.ts` — same pattern as B3:

- `createProject(tenantId, userId, dto)` → `PROJECT_CREATED`, metadata `{ name }`.
- `updateProject(tenantId, userId, projectId, dto)` → `before = getProjectById(...)`; `diffProject`; log `PROJECT_UPDATED` `{ name: updated.name, changes }` only when changes exist.
- `deleteProject(tenantId, userId, projectId)` → `before = getProjectById(...)` (has `_count.tasks`); in the transaction `tx.project.delete` then `PROJECT_DELETED` `{ name: before.name, taskCount: before._count.tasks }`. Tasks cascade at the DB level, so no per-task rows are written (FR-10).

**Check:** delete a project with 3 tasks → one `PROJECT_DELETED` row with `taskCount: 3`.

### B5. (reserved)

Org updates are deferred (decision 2). If that changes, add `ORGANIZATION_UPDATED` to `AuditAction` and log `{ changes }` in `updateOrganization` here.

### B6. Members

**File:** `backend/src/organizations/organizations.service.ts`

- Constructor: add `private readonly auditService: AuditService`.
- `addMember`: wrap `membership.create` in `$transaction`; log `MEMBER_ADDED`, `entityId = userToAdd.id`, metadata `{ memberName, memberEmail, membershipId, role }`.
- `updateMemberRole`: add `include: { user: { select: { name: true, email: true } } }` to the `targetMembership` lookup. After the existing permission checks, if `dto.role === targetMembership.role` return the current record without writing or logging (FR-6). Otherwise in `$transaction`: `tx.membership.update` + `ROLE_CHANGED`, `entityId = targetMembership.userId`, metadata `{ memberName, memberEmail, membershipId, changes: { role: { from, to } } }`.
- `removeMember`: same `include` on the target lookup. After all existing checks (sole OWNER etc.), in `$transaction`: `tx.membership.delete` + `MEMBER_REMOVED`, metadata `{ memberName, memberEmail, membershipId, role, selfRemoval: isSelfRemoval }`.
- `tenantId` for every call is `orgId`, only after `verifyMembership*` succeeded. Controller already passes `user.userId`; no controller change.

**Check:** add a member, change their role twice (second time to the same role), remove them → three rows, not four.

### B7. Activity endpoint

**New file:** `backend/src/audit/dto/query-activity.dto.ts` — exactly as spec §5.2 (`page`, `limit` default 20 max 100, `entity` `@IsEnum(AuditEntity)`, `entityId` / `actorId` `@IsUUID()`, `from` / `to` `@IsISO8601()`).

**File:** `backend/src/audit/audit.service.ts` — add:

```ts
async getActivity(tenantId: string, query: QueryActivityDto) {
  if (query.entityId && !query.entity) throw new BadRequestException('entity is required when entityId is set');
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    throw new BadRequestException('from must be before to');
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const where: Prisma.AuditLogWhereInput = {
    tenantId, // always first, never overridable
    ...(query.entity && { entity: query.entity }),
    ...(query.entityId && { entityId: query.entityId }),
    ...(query.actorId && { userId: query.actorId }),
    ...((query.from || query.to) && {
      createdAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) },
    }),
  };

  const [rows, total] = await Promise.all([
    this.prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    this.prisma.auditLog.count({ where }),
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      actor: r.user,          // null when the user was deleted
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

`entity` comes from the enum-validated DTO, so it can be spread straight into `where`. The mapper drops `tenantId` and `userId`.

**New file:** `backend/src/audit/activity.controller.ts`

```ts
@ApiTags('Activity')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Target Organization/Tenant ID', required: false })
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.ACTIVITY_READ)
  @ApiOperation({ summary: 'Tenant activity feed (tasks, projects, members)' })
  @ApiResponse({ status: 200, description: 'Activity retrieved' })
  @ApiResponse({ status: 400, description: 'Invalid filters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member or insufficient permissions' })
  getActivity(@CurrentTenant() tenant: TenantContext, @Query() query: QueryActivityDto) {
    return this.auditService.getActivity(tenant.tenantId, query);
  }
}
```

**File:** `backend/src/audit/audit.module.ts` — `controllers: [AuditController, ActivityController]`.

### B8. Permission

- `backend/src/permissions/permissions.enum.ts`: `ACTIVITY_READ = 'activity:read'` under the audit section.
- `backend/src/permissions/role-permissions.map.ts`: add `Permission.ACTIVITY_READ` to all five roles. Leave `AUDIT_READ` as is.

**Check:** Swagger shows the **Activity** tag; `GET /activity` as a VIEWER → 200 with the rows from B3–B6; `GET /audit-logs` as a VIEWER → 403.

---

## 3. Frontend steps

### F1. Types

**File:** `frontend/src/types/index.ts` — add `ActivityAction`, `ActivityEntity`, `FieldChange`, `ActivityMetadata`, `ActivityItem` and `Paginated<T>` exactly as spec §6.5. Do **not** remove `PaginatedResult` (decision 5); add a comment on it: `// Legacy flat shape; backend returns { data, meta }. Prefer Paginated<T>.`

### F2. API wrapper

**New file:** `frontend/src/api/activity.ts` — `ActivityQueryParams` + `activityApi.getActivity(params)` returning `Paginated<ActivityItem>` (spec §6.5).

### F3. Formatting helpers

**New file:** `frontend/src/components/activity/formatActivity.ts`

- `formatActivity(item: ActivityItem): { text: string; detail?: string }`, a `switch` on `item.action` with the sentences from spec §6.2. For `TASK_UPDATED`, look at the keys of `metadata.changes`:
  - only `status` → "moved “{title}” to {label}" using the same label map as `StatusBadge` (move that map to an exported `STATUS_LABELS` const in `Badge.tsx` rather than duplicating it).
  - only `assigneeId`/`assigneeName` → "assigned … to {to}" or "unassigned …".
  - only `description` → "updated the description of “{title}”".
  - otherwise "updated “{title}”" with `detail` = the changed field names joined by ", ".
- `default` → "{action} on {entity}" so new actions never crash the page.

**New file:** `frontend/src/components/activity/relativeTime.ts` — `formatRelativeTime(iso)` with `Intl.RelativeTimeFormat` ("just now" under 45s, then minutes/hours/days; older than 7 days → `toLocaleDateString`), and `dayLabel(iso)` returning "Today" / "Yesterday" / `Oct 21, 2026`.

(The spec puts `relativeTime.ts` in `components/common/`; keeping it next to its only consumer is simpler. Move it if a second feature needs it.)

### F4. Components

**New files** in `frontend/src/components/activity/`:

- `ActivityItem.tsx` — props `item`, `compact?`. Layout: `<Avatar name={item.actor?.name} avatarUrl={item.actor?.avatarUrl} size={compact ? 28 : 34} />`, then **actor name** (or "Deleted user") + `text`, `detail`/project name on a second muted line, time on the right with `title={new Date(createdAt).toLocaleString()}`. Links: projects → `/projects/:entityId`; tasks → `/projects/:metadata.projectId`; members → `/organization`. Skip the link for `*_DELETED` rows.
- `ActivityFeed.tsx` — props `items`, `groupByDay?`, `compact?`. Groups consecutive items by `dayLabel` when `groupByDay`, renders `ActivityItem`s.

Styles in `frontend/src/index.css`: `.activity-feed`, `.activity-day` (small uppercase muted heading), `.activity-item` (flex, gap 12px, padding, bottom border `var(--border-color)`), `.activity-item-text` (`text-overflow: ellipsis`), `.activity-time` (muted, `white-space: nowrap`). Follow the existing dark glass look.

### F5. Activity page

**New file:** `frontend/src/pages/ActivityPage.tsx` exporting `ActivityPage`.

- Read `entity` and `entityId` from `useSearchParams()` on mount; show a removable chip "History of “{name}”" (name taken from the first item's metadata) when `entityId` is present. Removing it clears both params.
- State per spec §6.2. Load members once per tenant with `organizationsApi.getMembers(activeTenant.id)` for the actor dropdown (`Promise.allSettled`, a failure just hides the dropdown).
- `fetchActivity()` in a `useEffect` on `[activeTenant?.id, page, entityFilter, entityId, actorFilter, from, to]`. Convert dates: `new Date(from + 'T00:00:00').toISOString()` and `new Date(to + 'T23:59:59.999').toISOString()`. If `from > to`, set an inline error and skip the call.
- A second `useEffect` on `activeTenant?.id` resets `page` to 1 and `actorFilter` to `''`.
- Keep the previous `items` on screen during refetch (`loading` vs `initialLoading`) so the list doesn't jump.
- Errors: `getApiErrorMessages(err, 'Failed to load activity')` in `.alert-error` with a Retry button; 403 → "You no longer have access to this organization's activity."
- Pagination block copied from `AuditLogsPage` but reading `res.meta.totalPages`.
- No active tenant → reuse the dashboard's "select or create an organization" empty state.

### F6. Audit Trail pagination fix

**Files:** `frontend/src/api/audit.ts` → return `Paginated<AuditLog>`; `frontend/src/pages/AuditLogsPage.tsx` → `setTotalPages(res.meta.totalPages || 1)`, `setTotal(res.meta.total || 0)`. Also fix its placeholder text `PROJECT_CREATE` → `PROJECT_CREATED`.

### F7. Route, nav, dashboard

- `frontend/src/App.tsx`: `<Route path="/activity" element={<ActivityPage />} />` in the `AppLayout` group.
- `frontend/src/components/layout/AppLayout.tsx`: import `Activity` from `lucide-react`; insert `{ to: '/activity', label: 'Activity', icon: Activity }` before "Audit Trail"; give the Audit Trail item `roles: ['OWNER', 'ADMIN']` and filter `navItems` with `!item.roles || (activeTenant && item.roles.includes(activeTenant.role))`.
- `frontend/src/pages/DashboardPage.tsx`: add `activityApi.getActivity({ limit: 5 })` to the existing `Promise.allSettled`; new state `activity` and `activityError`; new "Recent activity" `glass-card` at the top of the right column with `<ActivityFeed items={activity} compact />`, "View all" link to `/activity`, and "Couldn't load activity" on failure.
- `frontend/src/pages/ProjectDetailPage.tsx`: add a small "History" `btn-outline btn-sm` link to `/activity?entity=Project&entityId=<id>` in the header. (Optional, ~5 lines; gives the per-entity filter an entry point.)

---

## 4. Verification

### Backend unit tests

Mock pattern (all service specs): `prismaMock.$transaction = jest.fn((cb) => cb(txMock))`, where `txMock` has the model methods the service calls inside the transaction; `auditMock = { logAction: jest.fn() }` provided as `AuditService`.

**`backend/src/audit/audit-diff.spec.ts`**

| Test | Asserts |
|---|---|
| identical task | `{}` |
| status change | `{ status: { from: 'TODO', to: 'DONE' } }` only |
| assignee null → user | `assigneeId` and `assigneeName` changes |
| description edit | `{ description: { changed: true } }`, no text |

**`backend/src/tasks/tasks.service.spec.ts`**

| Test | Asserts |
|---|---|
| createTask logs | `logAction('t-a', 'u-1', 'TASK_CREATED', 'Task', id, { title, projectName, … }, txMock)` |
| updateTask status | `changes.status` correct; called once |
| updateTask no-op | `logAction` not called |
| deleteTask | `TASK_DELETED` with `title`, `projectName` |
| logAction rejects | `updateTask` rejects with the same error |
| task in other tenant | `NotFoundException`; `$transaction` and `logAction` not called |

**`backend/src/projects/projects.service.spec.ts`** — create/update/delete actions; `PROJECT_DELETED.taskCount` from `_count.tasks`; no-op update writes nothing.

**`backend/src/organizations/organizations.service.spec.ts`** — `MEMBER_ADDED` with `entityId` = added user and `tenantId` = orgId; `ROLE_CHANGED` `{ from, to }`; same role → no log, no update; self removal → `selfRemoval: true`; non-admin remove / sole OWNER → throws and `logAction` not called.

**`backend/src/audit/audit.service.spec.ts`** (`getActivity`)

| Test | Asserts |
|---|---|
| tenant always applied | every `findMany`/`count` `where` has `tenantId: 'A'` |
| **cross-tenant (must not leak)** | `getActivity('A', { entity: 'Task', entityId: <B task> })` and `{ actorId: <B-only user> }` → `data: []`, `where.tenantId === 'A'` |
| `entityId` without `entity` | `BadRequestException` |
| `from > to` | `BadRequestException` |
| mapping | `user: null` → `actor: null`; output has no `tenantId`/`userId` |
| order | `orderBy` is `[{ createdAt: 'desc' }, { id: 'desc' }]` |

**`backend/src/audit/dto/query-activity.dto.spec.ts`** — with `validate(obj, { whitelist: true, forbidNonWhitelisted: true })`: `limit: 101`, `entity: 'Org'`, `actorId: 'x'`, `from: 'yesterday'`, `tenantId: '…'` all invalid; a full valid query passes.

**Permissions** — one test in `audit.service.spec.ts` or a tiny `role-permissions.map.spec.ts`: every role includes `ACTIVITY_READ`; VIEWER/MEMBER/MANAGER lack `AUDIT_READ`.

Run: `cd backend && npm test`.

### Backend manual checks (curl or Swagger)

```bash
API=http://localhost:3000/api/v1

curl -s "$API/activity" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $ORG_A"                         # 200, newest first
curl -s "$API/activity?entityId=$TASK_ID" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $ORG_A"      # 400 entity required
curl -s "$API/activity?limit=101" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $ORG_A"              # 400
curl -s "$API/activity?tenantId=$ORG_B" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $ORG_A"        # 400 property tenantId should not exist
curl -s "$API/activity" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $ORG_NOT_MINE"                 # 403
curl -s "$API/audit-logs" -H "Authorization: Bearer $VIEWER_TOKEN" -H "x-tenant-id: $ORG_A"               # 403
```

Then the five manual steps in spec §8 (MEMBER task lifecycle, VIEWER access, two-org isolation).

### Frontend manual checks

The eight steps in spec §8 (nav visibility per role, Kanban move shows in feed, member events, filters + pagination, tenant switch, dashboard card, `/audit-logs` paging past page 1, backend down → Retry).

### Gates

```bash
cd backend  && npm run build && npm test
cd frontend && npm run build && npm run lint
```

(`backend npm run lint` is broken repo-wide per `CLAUDE.md`; not a gate here.)

---

## 5. Suggested commit sequence

Kept small so each one builds on its own:

1. `feat(audit): add activity indexes` — B1.
2. `feat(audit): action constants, diff helpers, transactional logAction` — B2.
3. `feat(tasks): log task create/update/delete` — B3.
4. `feat(projects): log project create/update/delete` — B4.
5. `feat(organizations): log member add/role change/remove` — B6.
6. `feat(audit): GET /activity and ACTIVITY_READ permission` — B7–B8.
7. `test(audit): activity logging and feed tests` — §4 specs.
8. `feat(frontend): activity types, API wrapper and feed components` — F1–F4.
9. `feat(frontend): activity page, nav and dashboard card` — F5, F7.
10. `fix(frontend): audit trail pagination reads meta` — F6.

---

## 6. File checklist

**Backend**
- [ ] M `backend/prisma/schema.prisma`
- [ ] A `backend/prisma/migrations/<ts>_activity_log/migration.sql` (generated)
- [ ] A `backend/src/audit/audit.constants.ts`
- [ ] A `backend/src/audit/audit-diff.ts`
- [ ] M `backend/src/audit/audit.service.ts`
- [ ] A `backend/src/audit/activity.controller.ts`
- [ ] A `backend/src/audit/dto/query-activity.dto.ts`
- [ ] M `backend/src/audit/audit.module.ts`
- [ ] M `backend/src/permissions/permissions.enum.ts`
- [ ] M `backend/src/permissions/role-permissions.map.ts`
- [ ] M `backend/src/tasks/tasks.service.ts`
- [ ] M `backend/src/tasks/tasks.controller.ts`
- [ ] M `backend/src/projects/projects.service.ts`
- [ ] M `backend/src/projects/projects.controller.ts`
- [ ] M `backend/src/organizations/organizations.service.ts`
- [ ] A `backend/src/audit/audit-diff.spec.ts`
- [ ] A `backend/src/audit/audit.service.spec.ts`
- [ ] A `backend/src/audit/dto/query-activity.dto.spec.ts`
- [ ] A `backend/src/tasks/tasks.service.spec.ts`
- [ ] A `backend/src/projects/projects.service.spec.ts`
- [ ] A `backend/src/organizations/organizations.service.spec.ts`

**Frontend**
- [ ] M `frontend/src/types/index.ts`
- [ ] A `frontend/src/api/activity.ts`
- [ ] M `frontend/src/api/audit.ts`
- [ ] A `frontend/src/components/activity/formatActivity.ts`
- [ ] A `frontend/src/components/activity/relativeTime.ts`
- [ ] A `frontend/src/components/activity/ActivityItem.tsx`
- [ ] A `frontend/src/components/activity/ActivityFeed.tsx`
- [ ] M `frontend/src/components/common/Badge.tsx` (export `STATUS_LABELS`)
- [ ] A `frontend/src/pages/ActivityPage.tsx`
- [ ] M `frontend/src/pages/AuditLogsPage.tsx`
- [ ] M `frontend/src/pages/DashboardPage.tsx`
- [ ] M `frontend/src/pages/ProjectDetailPage.tsx` (optional History link)
- [ ] M `frontend/src/App.tsx`
- [ ] M `frontend/src/components/layout/AppLayout.tsx`
- [ ] M `frontend/src/index.css`

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Interactive transactions on Neon's pooled connection (PgBouncer) time out or fail | Prisma interactive `$transaction` works through Neon's pooler in transaction mode; keep validation reads outside the callback so each transaction is two short statements. If timeouts appear, pass `{ timeout: 10000 }` or fall back to the batch form `$transaction([create, auditCreate])` where the id is known up front. |
| Migration run against the production Neon DB | Use a Neon dev branch in `DIRECT_URL`. Index-only migration. |
| An audit insert failure now blocks real changes | Intentional (decision 4); covered by the "logAction rejects" test. Audit insert has no unique constraints, so failures should only come from a DB outage. |
| Controller signature changes (`userId` param) missed in one handler | `npm run build` catches wrong arity; the service specs call every mutation with a `userId`. |
| Metadata shape drifts between backend and `formatActivity` | Shapes are listed once in `audit.constants.ts` / spec §5.4; `formatActivity` has a safe `default` branch, so an unknown shape degrades to a generic sentence instead of crashing. |
| Feed leaks another tenant's rows | `tenantId` is set first in `where` from `@CurrentTenant()` only; the DTO rejects `tenantId`; the cross-tenant unit test and the manual two-org check both cover it. |
| Hiding "Audit Trail" in nav is mistaken for access control | Backend `AUDIT_READ` still enforces it; the nav change is cosmetic. |
