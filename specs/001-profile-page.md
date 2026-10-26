# 001 — Profile Page

- **Status:** Draft
- **Feature #:** 001
- **Created:** 2026-10-26
- **Related:** `TenantFlow_PROJECT_SPEC.md` §9 User Model, §18 Authentication, §24 Frontend Pages (`/profile` listed under "Later"), §31 Frontend Security, §32 API Error Handling, §33 Validation, §42 Audit Logging, §43 Rate Limiting, §55 Frontend UX Rules, §57 Frontend Loading & Error Handling

## 1. Summary

Add a `/profile` page where any signed-in user can see and manage their own account: view their email and when they joined, edit their display name and avatar URL, change their password, and see every organization they belong to with their role in each. Users are global in TenantFlow (roles are per tenant), so the profile is **not tenant-scoped**: it is the same no matter which organization is active. Today the only user endpoint is the read-only `GET /auth/me`, and the header avatar is a non-clickable initial, so users have no way to fix a typo in their name or rotate their password.

## 2. Goals / Non-goals

**Goals**
- A user can update their `name` and `avatarUrl`.
- A user can change their password by confirming the current one.
- The header avatar links to the profile page and shows the avatar image when set.
- The profile page shows the user's organizations and role in each, and lets them switch to one.
- Add the `avatar_url` column that §9 of the project spec already defines.

**Non-goals**
- Changing email (needs verification flow; spec has no email service yet).
- Avatar file upload / storage (only an external `https://` URL for now).
- Forgot-password / reset-by-email (`/forgot-password` is a separate public feature).
- Revoking other sessions on password change (refresh tokens are stateless and not stored; see Open questions).
- Account deletion or leaving an organization.
- Viewing other users' profiles.

## 3. User stories

- As a **MEMBER**, I want to correct my display name so that teammates see the right name on tasks and in the audit trail.
- As a **VIEWER**, I want to set an avatar so that I'm recognisable in member lists, even though I can't edit tenant data.
- As an **OWNER**, I want to change my password so that I can rotate credentials after sharing a device.
- As an **ADMIN** in one organization and a **MEMBER** in another, I want to see all my organizations and my role in each so that I know what I can do where, and jump into one.
- As a **MANAGER**, I want my profile to look the same whichever organization is active so that I don't have to maintain it per tenant.

## 4. Functional requirements

- **FR-1** `GET /api/v1/auth/me` returns `{ id, email, name, avatarUrl, createdAt, updatedAt }` and never `passwordHash` (existing endpoint; response gains `avatarUrl`).
- **FR-2** `PATCH /api/v1/users/me` updates `name` and/or `avatarUrl` for the authenticated user only and returns the updated sanitized user.
- **FR-3** `name` is trimmed; after trimming it must be 1–100 characters.
- **FR-4** `avatarUrl` must be an absolute `https://` URL of at most 2048 characters, or `null` to clear it.
- **FR-5** A `PATCH /users/me` body with no fields, or with any undeclared field (`email`, `id`, `tenantId`, `passwordHash`, …), is rejected with 400.
- **FR-6** `PATCH /api/v1/users/me/password` with `{ currentPassword, newPassword }` changes the password when `currentPassword` matches the stored bcrypt hash; it returns `200 { message: 'Password updated successfully' }`.
- **FR-7** A wrong `currentPassword` returns **400** (not 401, so the frontend refresh interceptor does not fire) with message `Current password is incorrect`.
- **FR-8** `newPassword` must be 8–72 characters (8 matches `RegisterDto`; 72 is the bcrypt input limit) and must differ from `currentPassword`, otherwise 400.
- **FR-9** The new password is hashed with bcrypt (10 salt rounds, same as `AuthService`) and is never logged, returned, or stored in audit metadata.
- **FR-10** After a password change, logging in with the old password fails and logging in with the new one succeeds.
- **FR-11** All three endpoints require a valid access token (401 otherwise) and do **not** require `x-tenant-id`; a user with zero organizations can use them.
- **FR-12** The frontend route `/profile` renders inside `AppLayout` behind `ProtectedRoute`.
- **FR-13** The header avatar (initial or image) is a link to `/profile`, with an accessible label.
- **FR-14** After saving profile details, the header name/avatar update without a page reload.
- **FR-15** The profile page lists every organization from `AuthContext.organizations` with name, slug, `RoleBadge`, and a "Switch" action for non-active ones that calls `switchTenant(orgId)`.

## 5. Backend (NestJS + Prisma)

### 5.1 Data model

Only the `User` model changes. `User` is global (not tenant-owned), so no `tenantId` is added.

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String
  avatarUrl    String?  @map("avatar_url")      // NEW, nullable, max 2048 enforced in DTO
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships   Membership[]
  assignedTasks Task[]       @relation("TaskAssignee")
  auditLogs     AuditLog[]

  @@map("users")
}
```

- Nullable column, so the migration is additive and safe on existing rows. No new index (never filtered on).
- Migration: `npx prisma migrate dev --name profile-page`, then `npx prisma generate`.

### 5.2 API

| Method | Path (under `/api/v1`) | Permission | Description |
|---|---|---|---|
| GET | `/auth/me` | Authenticated (JWT only) | Existing. Returns the current user; now includes `avatarUrl`. |
| PATCH | `/users/me` | Authenticated (JWT only) | Update own `name` / `avatarUrl`. |
| PATCH | `/users/me/password` | Authenticated (JWT only) | Change own password. |

No list endpoints are added (the organizations list reuses existing `GET /organizations`).

**`PATCH /users/me`** — `UpdateProfileDto` (`src/users/dto/update-profile.dto.ts`)

```ts
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Geetanjali Nayak', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/me.png', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Avatar must be an https:// URL' })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
```

- Service rejects an empty object (`{}`) with `400 'Provide at least one field to update'`.
- Response `200`: `{ id, email, name, avatarUrl, createdAt, updatedAt }`.
- Errors: `400` validation / empty body / unknown field; `401` missing or invalid token; `404` user no longer exists (deleted between token issue and request).

**`PATCH /users/me/password`** — `ChangePasswordDto` (`src/users/dto/change-password.dto.ts`)

```ts
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({ description: '8–72 characters' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must be at most 72 characters long' })
  newPassword: string;
}
```

- Response `200`: `{ message: 'Password updated successfully' }`.
- Errors: `400` validation; `400 'Current password is incorrect'`; `400 'New password must be different from the current password'`; `401` missing or invalid token; `404` user not found.

All errors use the global filter shape `{ statusCode, message, error, timestamp, path }`.

### 5.3 Authorization & tenant isolation

- `UsersController` uses `@UseGuards(JwtAuthGuard)` **only**, the same as `GET /auth/me`. `TenantGuard` and `PermissionsGuard` are deliberately not applied: the profile is a global, self-owned resource, and requiring `x-tenant-id` would lock out users with no organizations. The standard `JwtAuthGuard, TenantGuard, PermissionsGuard` order still applies to every tenant-scoped endpoint and is unchanged.
- No new `Permission` values and no changes to `ROLE_PERMISSIONS_MAP`. Every role (OWNER through VIEWER) can manage their own profile.
- The target user id comes **only** from `@CurrentUser('userId')` (the JWT `sub`, re-validated against the DB in `JwtStrategy.validate`). There is no `:id` route param and the DTOs have no `id`/`email`/`tenantId` fields, so `forbidNonWhitelisted` rejects attempts to target another user or tenant.
- Queries use `prisma.user.update({ where: { id: userId } })` / `findUnique({ where: { id: userId } })`; `User` has no `tenantId`, so the `{ id, tenantId }` rule does not apply, but no other user's row is ever addressable.
- Responses always pass through `UsersService.sanitizeUser` so `passwordHash` is never returned.

### 5.4 Audit logging

`AuditLog.tenantId` is required and audit logs are read per tenant, while profile changes are global. For v1, **no `AuditService.logAction` calls** are made for profile or password changes. Server logs must not include password values either way. See Open question 1 for the proposed `PROFILE_UPDATED` / `PASSWORD_CHANGED` events.

### 5.5 Files

Create:
- `backend/src/users/users.controller.ts` — `@ApiTags('Users')`, `@ApiBearerAuth()`, `@Controller('users')`, `@UseGuards(JwtAuthGuard)`; `@Patch('me')` and `@Patch('me/password')` each with `@ApiOperation` and `@ApiResponse` for 200/400/401/404. No `@ApiHeader('x-tenant-id')` because it is not used.
- `backend/src/users/dto/update-profile.dto.ts`
- `backend/src/users/dto/change-password.dto.ts`
- `backend/src/users/users.service.spec.ts`

Modify:
- `backend/prisma/schema.prisma` + new migration folder.
- `backend/src/users/users.module.ts` — add `controllers: [UsersController]`.
- `backend/src/users/users.service.ts` — add:
  - `updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserWithoutPassword>` (empty-body check, `NotFoundException` if missing).
  - `changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }>` (load full user, `bcrypt.compare` current, reject same password, `bcrypt.hash(newPassword, 10)`, update).
- `backend/src/app.module.ts` — no change (`UsersModule` already registered).
- `backend/src/auth/auth.controller.ts` — no code change; `/auth/me` picks up `avatarUrl` automatically via `findById` + `sanitizeUser`.

## 6. Frontend (React + Vite)

### 6.1 Routes & navigation

- `App.tsx`: add `<Route path="/profile" element={<ProfilePage />} />` inside the existing `ProtectedRoute` + `AppLayout` route group.
- `AppLayout.tsx`: wrap the header avatar circle in `<Link to="/profile" aria-label="Your profile" title="Your profile">`. When `user.avatarUrl` is set, render `<img src={user.avatarUrl} alt="" />` in the circle with an `onError` fallback to the initial.
- Sidebar: no new main-nav item (profile is account-level, not tenant data); the header avatar is the entry point.

### 6.2 Pages & components

**`src/pages/ProfilePage.tsx`** — owns the page; reads `user`, `organizations`, `activeTenant`, `switchTenant`, `refreshProfile` from `useAuth()`.

```
┌ My Profile ───────────────────────────────────────────┐
│ [Avatar 72px]  Geetanjali Nayak                       │
│                user@tenantflow.com · Joined Sep 2026  │
├ Profile details (glass-card) ─────────────────────────┤
│ Name        [______________________]                  │
│ Avatar URL  [https://…_____________]  (preview)       │
│ Email       user@tenantflow.com  (read-only)          │
│                              [Cancel] [Save changes]  │
├ Change password (glass-card) ─────────────────────────┤
│ Current password  [••••••••]                          │
│ New password      [••••••••]                          │
│ Confirm password  [••••••••]                          │
│                                  [Update password]    │
├ Your organizations (table-container / data-table) ────┤
│ Name        Slug        Role        Joined    Action  │
│ Acme Inc    /acme       [ADMIN]     …         Active  │
│ Beta LLC    /beta       [MEMBER]    …         [Switch]│
└───────────────────────────────────────────────────────┘
```

Local state: `name`, `avatarUrl`, `savingProfile`, `profileError`, `profileMessage`; `currentPassword`, `newPassword`, `confirmPassword`, `savingPassword`, `passwordError`, `passwordMessage`; `switchingOrgId`.

Sub-components (kept in the same file unless they grow; extract to `src/components/profile/` if over ~150 lines each):
- `ProfileDetailsForm` — props: `user: User`, `onSaved: () => Promise<void>`.
- `ChangePasswordForm` — no props.
- `OrganizationsList` — props: `organizations: UserOrgMembership[]`, `activeTenantId?: string`, `onSwitch: (orgId: string) => Promise<void>`.

Reuse `RoleBadge` (`components/common/Badge.tsx`), `.glass-card`, `.input-group`/`.input-label`/`.input-field`, `.btn btn-primary`/`.btn-outline`, `.alert-error`/`.alert-success`, `.table-container`/`.data-table`, and the `Loader2 className="spinner"` pattern. `Modal` is not needed.

### 6.3 UI states

- **Loading:** `ProtectedRoute` already blocks until `user` is loaded. Save buttons show `Loader2` and are disabled while a request is in flight. The Switch button shows a spinner for the org being switched.
- **Empty:** no organizations → "You're not a member of any organization yet." with a "Create organization" button that opens `CreateOrganizationModal`. No avatar → initial letter.
- **Error:** inline `.alert-error` per form with the backend `message` (string or first item of an array). Switch failure shows an inline error under the table.
- **Success:** inline `.alert-success` ("Profile updated" / "Password updated"), auto-cleared after ~4s; password fields reset.
- **Permission-denied:** not applicable (every authenticated user can access their own profile). A 401 that survives refresh is handled by the `apiClient` interceptor (redirect to `/login`).

### 6.4 Role-based UI

Identical for OWNER, ADMIN, MANAGER, MEMBER and VIEWER: all can edit their own profile and password. The organizations list shows each role via `RoleBadge` but grants nothing; the backend remains the authority for anything tenant-scoped.

### 6.5 API integration & types

New `src/api/users.ts`:

```ts
export const usersApi = {
  updateProfile: async (data: UpdateProfileInput): Promise<User> => {
    const res = await apiClient.patch<User>('/users/me', data);
    return res.data;
  },
  changePassword: async (data: ChangePasswordInput): Promise<{ message: string }> => {
    const res = await apiClient.patch<{ message: string }>('/users/me/password', data);
    return res.data;
  },
};
```

`authApi.getMe` is unchanged and returns the new field.

`src/types/index.ts` additions:

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;   // NEW
  createdAt?: string;
  updatedAt?: string;
}

export interface UserOrgMembership extends Organization {
  role: Role;
  membershipId: string;  // NOTE: backend getUserOrganizations does not return this today
  joinedAt?: string;     // NEW, returned by backend getUserOrganizations
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
```

Refetch behaviour:
- After `updateProfile` succeeds, call `refreshProfile()` from `AuthContext` so the header and page share one source of truth.
- After a successful switch, `AuthContext.switchTenant` already refetches organizations; the page re-renders from context.
- Tenant switch while on the page: no refetch needed; profile data is global.

### 6.6 Forms & validation

**Profile details**
- `name`: required, trimmed, 1–100 chars.
- `avatarUrl`: optional; empty input sends `null` (clears it); otherwise must start with `https://` and parse via `new URL()`, max 2048 chars. Show a small preview `<img>` once valid.
- Send only changed fields; disable "Save changes" when nothing changed. "Cancel" resets to the current `user` values.

**Change password**
- `currentPassword`: required.
- `newPassword`: 8–72 chars, must differ from current.
- `confirmPassword`: must equal `newPassword` (client-only; not sent).
- Inputs use `type="password"` with `autoComplete="current-password"` / `"new-password"`.

Backend 400 errors: read `err.response?.data?.message`; if it is an array (class-validator), show each line in the form's `.alert-error`; otherwise show the string. Fall back to "Failed to update profile" / "Failed to update password".

## 7. Edge cases

- **Wrong current password:** backend returns 400, not 401, so `apiClient` does not try to refresh or redirect to `/login`.
- **Access token expires mid-save:** interceptor refreshes once and retries the PATCH; the save succeeds transparently.
- **Whitespace-only name:** trimmed to empty, rejected 400 (and client-side).
- **`avatarUrl` with `http://`, `javascript:` or `data:`:** rejected 400; prevents mixed content and script URLs in `<img src>`.
- **Avatar URL that 404s or is not an image:** `<img onError>` falls back to the initial; not validated server-side.
- **Empty PATCH body `{}`:** 400.
- **Body includes `email` / `tenantId` / `id`:** 400 via `forbidNonWhitelisted`.
- **User deleted after token issued:** `JwtStrategy.validate` already returns 401.
- **Password longer than 72 bytes:** rejected 400 rather than silently truncated by bcrypt. (Multi-byte characters can still exceed 72 bytes under 72 chars; see Open question 4.)
- **Other sessions after password change:** existing refresh tokens stay valid until expiry (7d default) because they are not stored. Documented limitation.
- **User with no organizations:** page works; no `x-tenant-id` header is sent and none is required.
- **Concurrent edits from two tabs:** last write wins; acceptable for single-owner data.
- **Long names in header:** truncate with ellipsis via CSS.

## 8. Testing plan

There are no `*.spec.ts` files yet; this feature adds the first.

**Backend Jest (`backend/src/users/users.service.spec.ts`)**, with `PrismaService` mocked:
- `updateProfile` updates only the caller's row (`where: { id: userId }`) and returns no `passwordHash`.
- `updateProfile` with `{}` throws `BadRequestException`.
- `updateProfile` with `avatarUrl: null` clears the field.
- `updateProfile` for a missing user throws `NotFoundException`.
- `changePassword` with the correct current password stores a new hash that `bcrypt.compare(newPassword, hash)` accepts.
- `changePassword` with a wrong current password throws `BadRequestException` and does not call `update`.
- `changePassword` with `newPassword === currentPassword` throws `BadRequestException`.
- **Cross-user / cross-tenant isolation test (must fail):** user A's token with a body containing `{ id: '<userB>', tenantId: '<orgB>', name: 'x' }` is rejected with 400 by the ValidationPipe (DTO-level test with `validate()` + `forbidNonWhitelisted`), and the service is never called with user B's id. Also assert user B's row is unchanged.
- DTO tests: `name` of 101 chars, `avatarUrl: 'http://x'`, `newPassword` of 7 and 73 chars are all invalid.

**Manual / e2e (Swagger or curl)**
1. `PATCH /users/me` without a token → 401.
2. `PATCH /users/me` without `x-tenant-id` and with a valid token → 200.
3. Change password, then log in with the old password → 401; new password → 200.

**Frontend manual steps**
1. Click the header avatar → lands on `/profile`.
2. Edit name → Save → header initial/name updates without reload.
3. Set a valid avatar URL → header shows image; set a broken URL → falls back to initial; clear it → initial.
4. Submit wrong current password → inline error, still logged in.
5. Mismatched confirm → client error, no request sent.
6. Switch org from the list → header tenant switcher updates and "Active" moves.
7. Log in as a user with no orgs → page renders with the empty state.

**Build checks:** `cd frontend && npm run build && npm run lint` must pass. `cd backend && npm run build && npm test` must pass. (`backend npm run lint` currently has no eslint installed/configured per `CLAUDE.md`; not a gate for this feature.)

## 9. Acceptance criteria

- [ ] Migration `profile-page` adds nullable `avatar_url` to `users`; `prisma generate` run.
- [ ] `GET /auth/me` includes `avatarUrl` and never `passwordHash`.
- [ ] `PATCH /users/me` updates name/avatar for the caller only; empty body and unknown fields return 400.
- [ ] `PATCH /users/me/password` requires the correct current password; wrong password returns 400 (not 401).
- [ ] New passwords are bcrypt-hashed; old password no longer logs in.
- [ ] Endpoints work with only `JwtAuthGuard`, no `x-tenant-id` required.
- [ ] Swagger shows the `Users` tag with both endpoints documented.
- [ ] `users.service.spec.ts` exists, passes, and includes the cross-user/tenant rejection test.
- [ ] `/profile` route exists inside `AppLayout`; header avatar links to it and shows the image when set.
- [ ] Profile save updates the header without reload (via `refreshProfile`).
- [ ] Password form validates confirm-match and length client-side and shows backend errors inline.
- [ ] Organizations list shows name, slug, role badge, and a working Switch action; empty state works.
- [ ] `User` and `UserOrgMembership` types updated; `src/api/users.ts` added.
- [ ] `npm run build` and `npm run lint` pass in `frontend/`; `npm run build` and `npm test` pass in `backend/`.

## 10. Open questions

1. **Audit events for profile/password changes.** `AuditLog.tenantId` is required, so a global event has no tenant to attach to. Options: (a) skip for now (this spec's default), (b) write `PROFILE_UPDATED` / `PASSWORD_CHANGED` into every tenant the user belongs to, (c) make `tenantId` nullable and add a user-level security log. Which one?
2. **Session revocation on password change.** Should we add a `tokenVersion` (or `passwordChangedAt`) column checked in `JwtStrategy` / refresh so old tokens die on password change? This overlaps with the spec's "Logout/revocation strategy" in §18.
3. **Rate limiting `PATCH /users/me/password`.** §43 calls for limits on auth-sensitive endpoints, but no throttler exists yet. Add `@nestjs/throttler` in this feature or in Phase 9?
4. **Password max length.** Enforce 72 characters (simple) or 72 bytes (exact bcrypt limit, stricter for non-ASCII)?
5. **`UserOrgMembership.membershipId`.** The frontend type declares it but `GET /organizations` does not return it. Fix the backend to return it, or drop it from the type?
6. **Avatar upload.** Is a URL field enough for now, or should a follow-up feature add file upload (S3/R2) and an allowlist of image hosts?
