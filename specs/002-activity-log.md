# 002 — Activity Log

- **Status:** Draft
- **Feature #:** 002
- **Created:** 2026-10-26
- **Related:** `TenantFlow_PROJECT_SPEC.md` §2 Product Vision (item 9 "View organization activity/audit history"), §15 AuditLog Model, §16 Tenant Isolation, §20 RBAC and Permissions, §24 Frontend Pages, §25 Frontend Dashboard ("recent activity"), §35 PostgreSQL Transactions, §42 Audit Logging, §48 Pagination, §53 Phase 12 Audit & Notifications, §57 Frontend Loading & Error Handling

## 1. Summary

Make TenantFlow record who changed what in each organization, and show it. The `AuditLog` model, `AuditService.logAction(...)`, `GET /audit-logs` and the `/audit-logs` "Audit Trail" page already exist, but nothing calls `logAction`, so the table is always empty. This feature wires `logAction` into every task, project and member mutation, writing the audit row in the same transaction as the change, with a small, consistent metadata shape (a snapshot of the entity's name and a `from → to` diff of changed fields). On top of that data it adds a human-readable **activity feed**: a new `GET /activity` endpoint and an `/activity` page that every role can read ("Priya moved *Fix login bug* to Done · 5 min ago"), plus a "Recent activity" card on the dashboard. The existing raw Audit Trail page stays as the OWNER/ADMIN compliance view over the same rows.

## 2. Goals / Non-goals

**Goals**
- Every create, update and delete of a task or project, and every member add, role change and removal, writes exactly one `AuditLog` row in the acting tenant.
- The audit row is written atomically with the change: if either fails, neither is saved.
- Standard action names and a documented metadata shape, so the feed can render sentences without extra lookups (deleted entities included).
- A tenant-scoped, paginated, filterable `GET /activity` endpoint readable by every role.
- An `/activity` page in the sidebar and a "Recent activity" card on the dashboard.
- Per-entity history: the feed can be filtered to one task or project (`entity` + `entityId`).

**Non-goals**
- `LOGIN`, `LOGOUT`, `ORGANIZATION_UPDATED`, organization creation, and profile/password events (login/logout have no tenant; see Open questions 1 and 2).
- Real-time updates (WebSocket/SSE) and notifications; the feed refreshes on load and on demand. Notifications are a separate Phase 12 feature.
- Filtering the feed by project across task events (needs a `project_id` column; see Open question 3).
- Retention, archival, export, or deletion of audit rows. Rows are append-only.
- Undo / restore from the log.
- Moving audit writes to a background job (§39 `process-audit`); Redis/BullMQ is not implemented yet.
- Redesigning the existing `/audit-logs` page beyond the pagination fix in §6.5.

## 3. User stories

- As a **MEMBER**, I want to see who moved a task to Done and when so that I don't have to ask in chat.
- As a **VIEWER**, I want to follow what changed in my organization this week so that I stay up to date even though I can't edit anything.
- As a **MANAGER**, I want to open a task's or project's history so that I can see who reassigned it or changed its priority.
- As an **ADMIN**, I want member additions, role changes and removals recorded so that I can review access changes.
- As an **OWNER**, I want every change to be attributable to a person in my organization only, so that the audit trail is trustworthy and never mixes in another tenant's data.
- As a **MEMBER** of two organizations, I want the feed to show only the active organization's activity so that I never see the other one's changes.

## 4. Functional requirements

- **FR-1** Creating a task writes `TASK_CREATED`; updating a task writes `TASK_UPDATED`; deleting a task writes `TASK_DELETED`.
- **FR-2** Creating, updating and deleting a project writes `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_DELETED`.
- **FR-3** Adding a member writes `MEMBER_ADDED`; changing a member's role writes `ROLE_CHANGED`; removing a member (or a member leaving) writes `MEMBER_REMOVED`.
- **FR-4** Each row has `tenantId` = the tenant the change happened in, `userId` = the authenticated actor, and `entity` / `entityId` per the table in §5.4.
- **FR-5** The audit row and the mutation are written in one Prisma `$transaction`. If the audit insert fails, the mutation is rolled back and the request returns 500.
- **FR-6** An update whose effective diff is empty (all submitted values equal the current ones) writes **no** row.
- **FR-7** `TASK_UPDATED` / `PROJECT_UPDATED` metadata contains a `changes` object with only the changed fields as `{ from, to }`. For `description`, only `{ changed: true }` is stored, not the text.
- **FR-8** Every row's metadata contains a snapshot of the entity's display name (`title` for tasks, `name` for projects, `memberName`/`memberEmail` for members), so deleted entities still render.
- **FR-9** Metadata never contains passwords, tokens, or full description text.
- **FR-10** Deleting a project writes one `PROJECT_DELETED` row with `taskCount`; the cascaded task deletions do not write individual `TASK_DELETED` rows.
- **FR-11** `GET /api/v1/activity` returns the active tenant's activity newest first as `{ data, meta: { total, page, limit, totalPages } }`, default `limit` 20, max 100.
- **FR-12** `GET /activity` supports filters `entity` (`Task | Project | Member`), `entityId` (UUID, requires `entity`), `actorId` (UUID), `from` and `to` (ISO 8601). Unknown query fields return 400.
- **FR-13** `GET /activity` requires the new `ACTIVITY_READ` permission, granted to all five roles.
- **FR-14** `GET /activity` never returns rows from a tenant other than the one resolved by `TenantGuard`, regardless of query params.
- **FR-15** Each feed item includes the actor as `{ id, name, email, avatarUrl }` or `null` if the user was deleted.
- **FR-16** The frontend route `/activity` renders inside `AppLayout` behind `ProtectedRoute` and has a sidebar entry "Activity".
- **FR-17** The dashboard shows a "Recent activity" card with the 5 newest items and a "View all" link to `/activity`.
- **FR-18** The `/activity` page and dashboard card refetch when the active tenant changes.
- **FR-19** The existing `/audit-logs` page shows the new rows and its pagination works (reads `meta.totalPages`).

## 5. Backend (NestJS + Prisma)

### 5.1 Data model

The `AuditLog` model already exists with `tenantId` and `@@index([tenantId, createdAt])`. No columns change. Two composite indexes are added for the new filters:

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String?  @map("user_id")
  action    String
  entity    String
  entityId  String   @map("entity_id")
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")

  tenant Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([tenantId, entity, entityId, createdAt]) // NEW: per-entity history
  @@index([tenantId, userId, createdAt])           // NEW: filter by actor
  @@map("audit_logs")
}
```

- `action` and `entity` stay `String` columns (not Prisma enums) so new actions don't need a migration; allowed values are fixed in code (§5.5 `audit.constants.ts`).
- `userId` stays nullable with `onDelete: SetNull`, so deleting a user keeps their history as "Deleted user".
- Index-only migration, safe on existing rows: `npx prisma migrate dev --name activity-log`, then `npx prisma generate`.

### 5.2 API

| Method | Path (under `/api/v1`) | Permission | Description |
|---|---|---|---|
| GET | `/activity` | `ACTIVITY_READ` (all roles) | NEW. Tenant activity feed, paginated and filterable. |
| GET | `/audit-logs` | `AUDIT_READ` (OWNER, ADMIN) | Existing, unchanged. Raw audit rows. |

No existing mutation endpoint changes its request or response; they only gain side effects (§5.4).

**`GET /activity`** — `QueryActivityDto` (`src/audit/dto/query-activity.dto.ts`)

```ts
export class QueryActivityDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: AuditEntity })
  @IsOptional()
  @IsEnum(AuditEntity)
  entity?: AuditEntity;

  @ApiPropertyOptional({ description: 'Requires entity' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by the user who performed the action' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
```

- The service checks `entityId` without `entity` → 400 `'entity is required when entityId is set'`, and `from > to` → 400 `'from must be before to'`.
- Query: `where: { tenantId, ...(entity && { entity }), ...(entityId && { entityId }), ...(actorId && { userId: actorId }), createdAt: { gte: from, lte: to } }`, `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` (stable order for same-millisecond rows).
- Response `200`:

```ts
{
  data: Array<{
    id: string;
    action: AuditAction;            // e.g. 'TASK_UPDATED'
    entity: AuditEntity;            // 'Task' | 'Project' | 'Member'
    entityId: string;
    actor: { id: string; name: string; email: string; avatarUrl: string | null } | null;
    metadata: ActivityMetadata;     // shape per action, see §5.4
    createdAt: string;              // ISO 8601
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}
```

- `tenantId` and raw `userId` are not included in feed items (the actor object replaces `userId`).
- Errors: `400` validation (bad UUID, bad date, `limit > 100`, unknown field, `entityId` without `entity`, `from > to`); `401` missing/invalid token; `403` not a member of the tenant (from `TenantGuard`) or missing `ACTIVITY_READ`.

All errors use the global filter shape `{ statusCode, message, error, timestamp, path }`.

### 5.3 Authorization & tenant isolation

- `ActivityController` uses `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)` in that order and `@RequirePermissions(Permission.ACTIVITY_READ)`.
- New permission in `permissions.enum.ts`: `ACTIVITY_READ = 'activity:read'`. Grant it in `ROLE_PERMISSIONS_MAP` to **OWNER, ADMIN, MANAGER, MEMBER and VIEWER**. Rationale: every role already has `TASK_READ`, `PROJECT_READ` and `MEMBER_READ`, and the feed exposes nothing beyond what those reads show. `AUDIT_READ` stays OWNER/ADMIN only.
- The tenant id comes only from `@CurrentTenant()` (`request.tenant.tenantId`, set by `TenantGuard` after the DB membership lookup). `QueryActivityDto` has no `tenantId` field, so `forbidNonWhitelisted` rejects one in the query.
- `where.tenantId` is always set first and filters cannot remove it. `entityId` and `actorId` from another tenant simply match nothing (empty `data`, `total: 0`), never 403/404, so the endpoint doesn't reveal whether an id exists elsewhere.
- Writes: `logAction` is called with the `tenantId` the mutation was already scoped to:
  - Tasks/projects: `tenant.tenantId` from `@CurrentTenant()`, which the services already use in `findFirst({ where: { id, tenantId } })`.
  - Members: `orgId` from the route, **after** `verifyMembership` / `verifyMembershipRole` has confirmed the actor belongs to it (these endpoints use `JwtAuthGuard` only).
- The actor id comes from `@CurrentUser('userId')`. `TenantContext` has no user id, so `TasksController` and `ProjectsController` gain a `@CurrentUser('userId') userId: string` parameter and pass it to the service. It is never read from the body.

### 5.4 Audit logging

This feature is the audit logging. Constants live in `src/audit/audit.constants.ts`:

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
```

**`AuditService.logAction` change:** add an optional last parameter `tx?: Prisma.TransactionClient` and use `(tx ?? this.prisma).auditLog.create(...)`. Type `action` as `AuditAction` and `entity` as `AuditEntity`. Existing callers (none today) are unaffected.

| Where (service method) | Action | entity / entityId | Metadata |
|---|---|---|---|
| `TasksService.createTask` | `TASK_CREATED` | `Task` / task id | `{ title, projectId, projectName, status, priority, assigneeId, assigneeName }` |
| `TasksService.updateTask` | `TASK_UPDATED` | `Task` / task id | `{ title, projectId, projectName, changes }` |
| `TasksService.deleteTask` | `TASK_DELETED` | `Task` / task id | `{ title, projectId, projectName }` |
| `ProjectsService.createProject` | `PROJECT_CREATED` | `Project` / project id | `{ name }` |
| `ProjectsService.updateProject` | `PROJECT_UPDATED` | `Project` / project id | `{ name, changes }` |
| `ProjectsService.deleteProject` | `PROJECT_DELETED` | `Project` / project id | `{ name, taskCount }` |
| `OrganizationsService.addMember` | `MEMBER_ADDED` | `Member` / added user's id | `{ memberName, memberEmail, membershipId, role }` |
| `OrganizationsService.updateMemberRole` | `ROLE_CHANGED` | `Member` / target user's id | `{ memberName, memberEmail, membershipId, changes: { role: { from, to } } }` |
| `OrganizationsService.removeMember` | `MEMBER_REMOVED` | `Member` / removed user's id | `{ memberName, memberEmail, membershipId, role, selfRemoval }` |

Notes:
- `entityId` for members is the **user id**, not the membership id, so a person who is removed and re-added has one continuous history. `membershipId` is kept in metadata.
- `title` / `name` in update metadata is the value **after** the update (so a rename row shows the new name, with the old one in `changes.title.from`).
- `changes` for tasks covers `title`, `status`, `priority`, `assigneeId` (with `assigneeName` added as `{ from, to }` names for display), and `description` as `{ changed: true }`. For projects: `name`, `description` (`{ changed: true }`).
- `ROLE_CHANGED` with the same role as before writes nothing (FR-6). Organization creation (implicit OWNER membership) writes nothing in v1.
- `createOrganization`, `updateOrganization`, `switchTenant`, auth and profile endpoints write nothing in v1.

**Transaction pattern** (example, `updateTask`):

```ts
async updateTask(tenantId: string, userId: string, taskId: string, dto: UpdateTaskDto) {
  const before = await this.getTaskById(tenantId, taskId);      // findFirst { id, tenantId }
  // ...existing assignee membership check...
  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: taskId }, data: { /* as today */ }, include: { /* as today */ } });
    const changes = diffTask(before, updated);                   // pure helper, see §5.5
    if (Object.keys(changes).length > 0) {
      await this.auditService.logAction(tenantId, userId, AuditAction.TASK_UPDATED, AuditEntity.TASK, taskId,
        { title: updated.title, projectId: updated.projectId, projectName: updated.project.name, changes }, tx);
    }
    return updated;
  });
}
```

`deleteProject` reads `_count.tasks` from `getProjectById` (it already includes it) for `taskCount`. `removeMember` and `updateMemberRole` load the target's `user { name, email }` before the delete/update so the snapshot survives.

### 5.5 Files

Create:
- `backend/src/audit/audit.constants.ts` — `AuditAction`, `AuditEntity`, and the `ActivityMetadata` TypeScript types per action.
- `backend/src/audit/audit-diff.ts` — pure helpers `diffTask(before, after)` and `diffProject(before, after)` returning the `changes` object.
- `backend/src/audit/activity.controller.ts` — `@ApiTags('Activity')`, `@ApiBearerAuth()`, `@ApiHeader({ name: 'x-tenant-id', required: false })`, `@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)`, `@Controller('activity')`; one `@Get()` with `@RequirePermissions(Permission.ACTIVITY_READ)`, `@ApiOperation`, `@ApiResponse` for 200/400/401/403.
- `backend/src/audit/dto/query-activity.dto.ts`
- `backend/src/audit/audit.service.spec.ts`, `backend/src/audit/audit-diff.spec.ts`
- `backend/src/tasks/tasks.service.spec.ts`, `backend/src/projects/projects.service.spec.ts`, `backend/src/organizations/organizations.service.spec.ts`

Modify:
- `backend/prisma/schema.prisma` + new migration folder `*_activity_log`.
- `backend/src/audit/audit.service.ts` — `logAction(..., tx?)` typed with the enums; new `getActivity(tenantId: string, query: QueryActivityDto)` that selects `user: { select: { id, name, email, avatarUrl } }` and maps rows to the feed item shape.
- `backend/src/audit/audit.module.ts` — add `ActivityController` to `controllers`.
- `backend/src/permissions/permissions.enum.ts`, `backend/src/permissions/role-permissions.map.ts` — `ACTIVITY_READ` for all roles.
- `backend/src/tasks/tasks.service.ts`, `tasks.controller.ts` — inject `AuditService`; add `userId` param to `createTask`, `updateTask`, `deleteTask`; wrap writes in `$transaction`.
- `backend/src/projects/projects.service.ts`, `projects.controller.ts` — same for `createProject`, `updateProject`, `deleteProject`.
- `backend/src/organizations/organizations.service.ts` — inject `AuditService`; log in `addMember`, `updateMemberRole`, `removeMember` (controller already passes `user.userId`).
- `backend/src/app.module.ts` — no change (`AuditModule` is registered and global).

## 6. Frontend (React + Vite)

### 6.1 Routes & navigation

- `App.tsx`: add `<Route path="/activity" element={<ActivityPage />} />` inside the existing `ProtectedRoute` + `AppLayout` group.
- `AppLayout.tsx` `navItems`: insert `{ to: '/activity', label: 'Activity', icon: Activity }` (lucide-react `Activity`) after "Members & Roles" and before "Audit Trail".
- Hide the "Audit Trail" nav item for roles other than OWNER/ADMIN (`activeTenant.role`), since those roles get 403 there today. The backend stays the authority.

### 6.2 Pages & components

**`src/pages/ActivityPage.tsx`** — owns filters, pagination and fetching; reads `activeTenant` from `useAuth()`.

```
┌ Activity ─────────────────────────────────── [⟳ Refresh] ┐
│ Everything that changed in Acme Inc (128 events)         │
├ Filters (glass-card) ────────────────────────────────────┤
│ [All types ▾] [Anyone ▾] [From ____] [To ____] [Clear]   │
├ Today ───────────────────────────────────────────────────┤
│ (P) Priya moved "Fix login bug" to Done     · 5 min ago  │
│     Project: Website                                     │
│ (A) Arjun changed Sam's role MEMBER → MANAGER · 1 h ago  │
├ Yesterday ───────────────────────────────────────────────┤
│ (G) Geetanjali created project "Mobile app"  · 14:02     │
│ (?) Deleted user deleted task "Old spike"    · 09:41     │
└──────────────────────────── [‹ Previous] Page 1 of 7 [Next ›]
```

Local state: `items`, `loading`, `error`, `page`, `totalPages`, `total`, `entityFilter`, `actorFilter`, `from`, `to`; `members` (for the "Anyone" dropdown, from `organizationsApi.getMembers(activeTenant.id)`).

Components (`src/components/activity/`):
- `ActivityItem.tsx` — props: `item: ActivityItem`, `compact?: boolean`. Renders `Avatar` (existing `components/common/Avatar.tsx`) with the actor's name/avatar, the sentence from `formatActivity`, the relative time (absolute time in `title`), and a secondary line (project name for tasks). Entity names link to `/projects/:id` for live projects/tasks; deleted ones render as plain text with a muted "(deleted)" suffix.
- `ActivityFeed.tsx` — props: `items: ActivityItem[]`, `groupByDay?: boolean`, `compact?: boolean`. Groups by local calendar day ("Today", "Yesterday", `Oct 21, 2026`).
- `formatActivity.ts` — pure `formatActivity(item): { text: string; detail?: string }` mapping each `AuditAction` + metadata to a sentence, for example:
  - `TASK_CREATED` → "created task “{title}”"
  - `TASK_UPDATED` with `changes.status` only → "moved “{title}” to {StatusLabel}"; with `changes.assigneeId` only → "assigned “{title}” to {to name}" / "unassigned “{title}”"; several fields → "updated “{title}”" with detail "status, priority".
  - `PROJECT_DELETED` → "deleted project “{name}” and its {taskCount} tasks"
  - `ROLE_CHANGED` → "changed {memberName}'s role from {from} to {to}"
  - `MEMBER_REMOVED` with `selfRemoval` → "left the organization"
  - Unknown action → "{action} on {entity}" (forward compatible).
- `src/components/common/relativeTime.ts` — `formatRelativeTime(iso)` via `Intl.RelativeTimeFormat`.

Reuse `Avatar`, `RoleBadge`, `StatusBadge` (inline in sentences where it reads well), `.glass-card`, `.input-field`, `.btn btn-secondary btn-sm`, `.alert-error`, and the `Loader2 className="spinner"` pattern. `Modal` is not needed.

**`DashboardPage.tsx`** — add a "Recent activity" `glass-card` in the right column, above "Task Status Breakdown": `activityApi.getActivity({ limit: 5 })` added to the existing `Promise.allSettled`, rendered with `<ActivityFeed items={…} compact />` and a "View all" `Link` to `/activity`. A failure here hides the card's list and shows "Couldn't load activity" without affecting the rest of the dashboard.

### 6.3 UI states

- **Loading:** first load shows a centred `Loader2`; page/filter changes keep the old list dimmed with a small spinner in the header so the layout doesn't jump.
- **Empty:** no events at all → "No activity yet. Changes to projects, tasks and members will show up here." With filters → "No activity matches these filters." plus a "Clear filters" button.
- **Error:** `.alert-error` with `getApiErrorMessages(err, 'Failed to load activity')` and a "Retry" button.
- **Success:** list rendered; "Refresh" re-fetches the current page.
- **Permission-denied:** every role has `ACTIVITY_READ`, so 403 only happens if the user was removed from the tenant mid-session; show "You no longer have access to this organization's activity." No active tenant → same "select or create an organization" state the dashboard uses.

### 6.4 Role-based UI

- **All roles (OWNER, ADMIN, MANAGER, MEMBER, VIEWER):** see `/activity` and the dashboard card with the same content; the page is read-only.
- **OWNER, ADMIN:** additionally see the "Audit Trail" nav item and raw `/audit-logs` page (unchanged).
- **MANAGER, MEMBER, VIEWER:** "Audit Trail" nav item hidden.
- Links from feed items lead to pages that enforce their own permissions as today.

### 6.5 API integration & types

New `src/api/activity.ts`:

```ts
export interface ActivityQueryParams {
  page?: number;
  limit?: number;
  entity?: ActivityEntity;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export const activityApi = {
  getActivity: async (params?: ActivityQueryParams): Promise<Paginated<ActivityItem>> => {
    const res = await apiClient.get<Paginated<ActivityItem>>('/activity', { params });
    return res.data;
  },
};
```

`src/types/index.ts` additions:

```ts
export type ActivityAction =
  | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED'
  | 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_DELETED'
  | 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'ROLE_CHANGED';

export type ActivityEntity = 'Task' | 'Project' | 'Member';

export interface FieldChange<T = unknown> { from: T; to: T }

export interface ActivityMetadata {
  title?: string;
  name?: string;
  projectId?: string;
  projectName?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
  taskCount?: number;
  memberName?: string;
  memberEmail?: string;
  membershipId?: string;
  role?: Role;
  selfRemoval?: boolean;
  changes?: Record<string, FieldChange | { changed: true }>;
}

export interface ActivityItem {
  id: string;
  action: ActivityAction | string;   // string keeps unknown future actions renderable
  entity: ActivityEntity;
  entityId: string;
  actor: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  metadata: ActivityMetadata | null;
  createdAt: string;
}

// Matches the backend list shape { data, meta }
export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
```

**Existing pagination bug:** the current `PaginatedResult<T>` type is flat (`{ data, total, page, limit, totalPages }`), but every backend list returns `{ data, meta: {...} }`. So `AuditLogsPage` and `ProjectsPage` always read `totalPages` as `undefined` → 1, and "Next" never appears. This feature fixes `auditApi.getAuditLogs` and `AuditLogsPage` to use `Paginated<T>` / `res.meta` (FR-19). Migrating `ProjectsPage`, tasks and the rest to `Paginated<T>` and deleting `PaginatedResult` is Open question 5.

Refetch behaviour:
- `ActivityPage` and the dashboard card include `activeTenant?.id` in their `useEffect` deps, so a tenant switch refetches and resets `page` to 1 and clears the actor filter (members differ per tenant).
- No cross-page invalidation: after a mutation elsewhere, the feed is current the next time it is opened or refreshed.

### 6.6 Forms & validation

The page has a filter bar only, no data entry.
- **Type:** select with "All types", "Tasks", "Projects", "Members" → `entity`.
- **Actor:** select with "Anyone" + tenant members (name, email) → `actorId`.
- **From / To:** `<input type="date">`. Sent as the local day's start (`T00:00:00`) and end (`T23:59:59.999`) converted to ISO strings. Client blocks `from > to` with an inline message and doesn't send the request.
- Any filter change resets `page` to 1.
- `entityId` is not exposed in the filter bar; it is set from deep links (`/activity?entity=Task&entityId=<id>`), which the page reads from `useSearchParams` and shows as a removable "History of “{title}”" chip.
- A backend 400 (e.g. hand-edited URL with a bad UUID) shows in `.alert-error` via `getApiErrorMessages` and offers "Clear filters".

## 7. Edge cases

- **Audit insert fails** (DB error): the whole transaction rolls back; the user sees the normal 500 and the task/project/member is unchanged.
- **No-op update** (PATCH with identical values, or role set to the current role): no row written.
- **Entity later deleted:** its earlier rows still render from metadata snapshots; links become plain text "(deleted)". The frontend decides "deleted" by checking for a later `*_DELETED` row in the same page, otherwise by the link target returning 404 (acceptable).
- **Project deleted with tasks:** one `PROJECT_DELETED` row with `taskCount`; earlier `TASK_*` rows for its tasks stay.
- **Actor deleted** (`userId` set null by FK): `actor: null`, rendered as "Deleted user" with a generic avatar.
- **Actor removed from the tenant but user still exists:** rows keep the actor's name and avatar; the actor filter list (current members only) won't include them, which is acceptable.
- **Member leaves themselves:** `MEMBER_REMOVED` with `selfRemoval: true`, actor = the member; they lose access to the feed right away.
- **Sole OWNER removal attempt:** request fails with 400 before the transaction; nothing logged.
- **Cross-tenant ids in filters:** `entityId`/`actorId` from tenant B in tenant A's feed → empty result, not an error.
- **`x-tenant-id` for an org the user isn't in:** 403 from `TenantGuard`.
- **Many rows in the same millisecond** (bulk actions later): stable order via `id` tie-breaker.
- **Long titles/names:** truncated with ellipsis in the feed; full text in `title` attribute.
- **Description edits:** shown as "updated the description of “{title}”"; text never stored in the log.
- **Timezone:** day grouping and date filters use the browser's local time; the API stores and returns UTC.
- **Organization deleted:** `onDelete: Cascade` removes its audit rows (existing behaviour).

## 8. Testing plan

`users.service.spec.ts` and `users.dto.spec.ts` already exist (feature 001); follow their mocking style.

**Backend Jest**, with `PrismaService` mocked (`$transaction` invokes the callback with a mock `tx`):
- `audit-diff.spec.ts`: `diffTask` returns only changed fields; description → `{ changed: true }`; identical input → `{}`; assignee null ↔ id handled.
- `tasks.service.spec.ts`:
  - `createTask` calls `logAction(tenantId, userId, 'TASK_CREATED', 'Task', task.id, {...}, tx)` with the snapshot fields.
  - `updateTask` with a status change logs `changes.status = { from: 'TODO', to: 'DONE' }`; a no-op update calls `logAction` zero times.
  - `deleteTask` logs `TASK_DELETED` with `title` and `projectName`.
  - If `logAction` rejects, `updateTask` rejects (transaction rollback is Prisma's job; assert the error propagates).
  - Task in another tenant → `NotFoundException` and `logAction` not called.
- `projects.service.spec.ts`: create/update/delete log the right action; `deleteProject` includes `taskCount`.
- `organizations.service.spec.ts`: `addMember` → `MEMBER_ADDED` with `entityId` = added user id and `tenantId` = orgId; `updateMemberRole` → `ROLE_CHANGED` with `{ from, to }`; same role → no log; `removeMember` self → `selfRemoval: true`; forbidden or sole-OWNER cases → no log.
- `audit.service.spec.ts` (`getActivity`):
  - `where.tenantId` is always the passed tenant; filters are added on top.
  - **Cross-tenant isolation test (must fail to leak):** with rows for tenant A and B in the mock, `getActivity('A', { entityId: <B's task id>, entity: 'Task' })` and `getActivity('A', { actorId: <B-only user> })` return `data: []`; assert every Prisma call's `where` contains `tenantId: 'A'`.
  - `entityId` without `entity` and `from > to` → `BadRequestException`.
  - Mapping: `user: null` → `actor: null`; `tenantId`/`userId` not in output.
- DTO tests (`query-activity.dto.spec.ts`): `limit: 101`, `entity: 'Org'`, `actorId: 'x'`, `from: 'yesterday'`, unknown field `tenantId` are invalid.
- Permissions: `ROLE_PERMISSIONS_MAP[Role.VIEWER]` includes `ACTIVITY_READ` and not `AUDIT_READ`.

**Manual / e2e (Swagger or curl)**
1. Create, rename and delete a task as a MEMBER → three rows in `GET /activity`, correct actor, newest first.
2. `GET /activity` as VIEWER → 200; `GET /audit-logs` as VIEWER → 403.
3. `GET /activity` with `x-tenant-id` of an org the user isn't in → 403.
4. Two orgs: changes in org B never appear in org A's feed.
5. `GET /activity?entityId=<uuid>` without `entity` → 400; `?limit=101` → 400.

**Frontend manual steps**
1. Sidebar shows "Activity"; "Audit Trail" only for OWNER/ADMIN.
2. Move a task to Done on the Kanban, open `/activity` → "You moved “…” to Done · just now".
3. Change a member's role, remove a member, have a member leave → three readable entries.
4. Filter by type, actor and dates; clear filters; pagination Next/Previous works.
5. Switch tenant while on `/activity` → list reloads for the new org, page 1, actor filter cleared.
6. Dashboard shows the 5 newest items; "View all" opens `/activity`.
7. `/audit-logs` paginates past page 1 once there are more than 15 rows.
8. Stop the backend → error alert with Retry.

**Build checks:** `cd frontend && npm run build && npm run lint` must pass. `cd backend && npm run build && npm test` must pass. (`backend npm run lint` has no eslint installed/configured per `CLAUDE.md`; not a gate.)

## 9. Acceptance criteria

- [ ] Migration `activity-log` adds the two composite indexes on `audit_logs`; `prisma generate` run.
- [ ] `AuditAction` / `AuditEntity` constants exist; `logAction` accepts an optional transaction client.
- [ ] Task create/update/delete, project create/update/delete, member add/role change/remove each write exactly one row in the same transaction; no-op updates write none.
- [ ] Metadata matches §5.4, includes name snapshots and `changes` diffs, and never includes description text, passwords or tokens.
- [ ] `PROJECT_DELETED` includes `taskCount`; cascaded task deletes write no rows.
- [ ] `GET /activity` returns `{ data, meta }`, supports `entity`, `entityId`, `actorId`, `from`, `to`, and rejects invalid params with 400.
- [ ] `ACTIVITY_READ` exists and is granted to all five roles; `AUDIT_READ` unchanged.
- [ ] `GET /activity` only ever returns the resolved tenant's rows; the cross-tenant test passes.
- [ ] Swagger shows the `Activity` tag with the endpoint documented.
- [ ] New spec files for tasks, projects, organizations, audit service, diff helper and DTO exist and pass.
- [ ] `/activity` route and sidebar entry exist; feed renders readable sentences, day groups, relative times and actor avatars.
- [ ] Filters, pagination, empty, error and loading states work; tenant switch refetches.
- [ ] Dashboard "Recent activity" card shows 5 items and links to `/activity`.
- [ ] "Audit Trail" nav hidden for MANAGER/MEMBER/VIEWER; `/audit-logs` pagination reads `meta`.
- [ ] `ActivityItem`, `ActivityMetadata`, `Paginated<T>` types and `src/api/activity.ts` added.
- [ ] `npm run build` and `npm run lint` pass in `frontend/`; `npm run build` and `npm test` pass in `backend/`.

## 10. Open questions

1. **`LOGIN` / `LOGOUT` events.** §42 lists them, but login happens before a tenant is chosen and `AuditLog.tenantId` is required. Same choice as 001 Open question 1: skip (default here), write one row per membership, or make `tenantId` nullable for a user-level security log?
2. **`ORGANIZATION_UPDATED`.** Easy to add in `updateOrganization` (name/slug diff). Include it in this feature or leave it for an org-settings feature?
3. **Project filter for task events.** "Everything in project X" needs a nullable `project_id` column on `audit_logs` (indexed with `tenantId`), or a JSON-path filter on `metadata.projectId` (unindexed). Add the column now, or defer the project filter?
4. **Should audit failures block the change?** This spec makes them atomic (§35, FR-5). The alternative is log-after-commit and swallow errors, which never blocks users but can lose rows. Confirm atomic.
5. **Fix `PaginatedResult` everywhere.** Migrate all list wrappers/pages to `Paginated<T>` (`{ data, meta }`) in this feature, or only the audit/activity pages here and the rest in a small follow-up?
6. **Should VIEWERs see member/role changes in the feed?** They already have `MEMBER_READ`, so this spec says yes. If role changes should be OWNER/ADMIN-only, the service would filter `entity: 'Member'` out for other roles.
7. **Retention.** Keep rows forever for now, or set a retention window (e.g. 1 year) tied to subscription plans (§41)?
