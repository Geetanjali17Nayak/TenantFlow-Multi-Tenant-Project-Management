# 001 — Profile Page: Technical Plan

- **Spec:** [`specs/001-profile-page.md`](./001-profile-page.md)
- **Created:** 2026-10-26
- **Status:** Ready to implement
- **Estimated effort:** ~1 day (backend ~3h, frontend ~4h, tests + verification ~1–2h)

This plan turns the spec into ordered, independently verifiable steps. Backend lands first so the frontend can be built against a real API. Each step ends with a check you can run before moving on.

---

## 0. Decisions assumed for the spec's open questions

The plan uses these defaults so work can start now. Changing any of them affects only the step noted.

| # | Open question | Default in this plan | Step affected if changed |
|---|---|---|---|
| 1 | Audit events for profile/password | **Skip** (no `AuditService` calls) | B4 |
| 2 | Revoke sessions on password change | **Not in this feature**; documented limitation | B4 (would add a `tokenVersion` column in B1) |
| 3 | Rate limit password endpoint | **Defer** to Phase 9 (no throttler yet) | B5 |
| 4 | Password max: 72 chars vs 72 bytes | **72 chars** (`@MaxLength(72)`) | B3 |
| 5 | `UserOrgMembership.membershipId` mismatch | **Fix backend**: return `membershipId` from `getUserOrganizations` (one line, avoids a lying type) | B6 |
| 6 | Avatar upload | **URL only** | — |

---

## 1. Context that shapes the implementation

Checked in the current code:

- `main.ts` global `ValidationPipe` has `whitelist`, `forbidNonWhitelisted`, `transform: true` and implicit conversion, so `@Transform` trimming in DTOs works and unknown fields are rejected automatically.
- `UsersModule` has a provider only, no controller. `AuthModule` imports `UsersModule` and registers `JwtStrategy`, so `UsersModule` must **not** import `AuthModule` (circular). Importing the `JwtAuthGuard` class directly from `../auth/guards/jwt-auth.guard` is fine: it is just `AuthGuard('jwt')` and the strategy is registered globally by Passport.
- `bcrypt`, `class-transformer`, `@nestjs/testing`, `jest`, `ts-jest` are already installed. Jest config is in `backend/package.json` (`rootDir: src`, `*.spec.ts`). No new dependencies needed on either side.
- `AuthService` uses `saltRounds = 10`. The users service should use the same value.
- Frontend `apiClient` retries any 401 via refresh and redirects to `/login` on failure, which is why a wrong current password must be **400**.
- `AuthContext` already exposes `refreshProfile()` (calls `/auth/me` and `setUser`), so no context changes are needed.
- Styling is global classes in `frontend/src/index.css` plus inline styles. The plan reuses `.glass-card`, `.input-*`, `.btn*`, `.alert-*`, `.data-table`, and adds a few `.profile-*` classes.

---

## 2. Backend steps

### B1. Schema + migration

**File:** `backend/prisma/schema.prisma`

Add to `model User` after `name`:

```prisma
avatarUrl    String?  @map("avatar_url")
```

**Commands** (from `backend/`):

```bash
npx prisma migrate dev --name profile-page
npx prisma generate
```

Expected: new folder `prisma/migrations/<timestamp>_profile_page/migration.sql` containing
`ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;`

**Check:** `npm run build` passes; `GET /api/v1/auth/me` now returns `"avatarUrl": null`. (No code change is needed in `AuthController`: `findById` + `sanitizeUser` spread every non-password field.)

> Note: `migrate dev` runs against the Neon `DIRECT_URL` in `backend/.env`. Point it at a dev branch database, not production.

### B2. `UpdateProfileDto`

**New file:** `backend/src/users/dto/update-profile.dto.ts`

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Geetanjali Nayak', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/me.png', nullable: true, maxLength: 2048 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Avatar must be an https:// URL' })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
```

Gotcha: `@IsOptional()` treats `null` as "skip validation", which is what we want for clearing the avatar. `@ValidateIf` makes the intent explicit and keeps it working if `IsOptional` is ever removed.

### B3. `ChangePasswordDto`

**New file:** `backend/src/users/dto/change-password.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The password currently on the account' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({ description: '8–72 characters', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(72, { message: 'Password must be at most 72 characters long' })
  newPassword: string;
}
```

### B4. `UsersService` methods

**File:** `backend/src/users/users.service.ts`

Add imports `BadRequestException`, `bcrypt`, the two DTOs, and a constant `const SALT_ROUNDS = 10; // keep in sync with AuthService`.

```ts
async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserWithoutPassword> {
  const data: { name?: string; avatarUrl?: string | null } = {};
  if (dto.name !== undefined) data.name = dto.name;
  if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

  if (Object.keys(data).length === 0) {
    throw new BadRequestException('Provide at least one field to update');
  }

  const existing = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new NotFoundException('User not found');

  const user = await this.prisma.user.update({ where: { id: userId }, data });
  return this.sanitizeUser(user);
}

async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');

  const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
  if (!matches) {
    // 400, not 401: a 401 would trigger the frontend refresh/redirect interceptor
    throw new BadRequestException('Current password is incorrect');
  }

  if (dto.currentPassword === dto.newPassword) {
    throw new BadRequestException('New password must be different from the current password');
  }

  const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
  await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { message: 'Password updated successfully' };
}
```

Notes:
- The current-password check runs before the "same password" check so the endpoint never confirms whether a guessed password equals the new one.
- No audit call (decision 1). Do not log `dto` anywhere.
- `NotFoundException` is already imported but unused today; it becomes used here.

### B5. `UsersController`

**New file:** `backend/src/users/users.controller.ts`

```ts
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard) // global, self-owned resource: no TenantGuard / PermissionsGuard
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile (name, avatar)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 400, description: 'Validation failure or empty body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Validation failure or incorrect current password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto);
  }
}
```

`PATCH` returns 200 by default in Nest, so no `@HttpCode` is needed.

**File:** `backend/src/users/users.module.ts` — add `controllers: [UsersController]`. `app.module.ts` needs no change.

**Check:** `npm run dev`, open Swagger at `http://localhost:3000/api/docs`, confirm the **Users** tag shows both endpoints, then run the curl checks in §4.

### B6. Return `membershipId` from `GET /organizations` (decision 5)

**File:** `backend/src/organizations/organizations.service.ts`, `getUserOrganizations` mapper: add `membershipId: m.id,`. Additive; no frontend code reads it today.

---

## 3. Frontend steps

### F1. Types

**File:** `frontend/src/types/index.ts`

- `User`: add `avatarUrl?: string | null;`
- `UserOrgMembership`: add `joinedAt?: string;` (already returned by the backend).
- Add:

```ts
export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
```

### F2. API wrapper

**New file:** `frontend/src/api/users.ts`

```ts
import { apiClient } from './apiClient';
import type { ChangePasswordInput, UpdateProfileInput, User } from '../types';

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

### F3. Shared helpers (small, colocated)

**New file:** `frontend/src/utils/apiError.ts`

```ts
export const getApiErrorMessages = (err: any, fallback: string): string[] => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message;
  if (typeof message === 'string') return [message];
  return [fallback];
};
```

Existing pages inline `err.response?.data?.message || '...'`; this helper also handles class-validator's array messages. Only the profile page uses it in this feature (don't refactor other pages here).

**New component:** `frontend/src/components/common/Avatar.tsx`

- Props: `name?: string`, `avatarUrl?: string | null`, `size?: number` (default 34).
- Renders `<img>` when `avatarUrl` is set; on `onError` sets local `failed` state and falls back to the first letter of `name` (or `UserIcon`).
- Reset `failed` when `avatarUrl` changes (`useEffect` on `avatarUrl`).
- `alt=""` (decorative; the surrounding link carries the label).

Used by both `AppLayout` and `ProfilePage`, so the fallback logic lives in one place.

### F4. Profile page

**New file:** `frontend/src/pages/ProfilePage.tsx` exporting `ProfilePage`.

Structure (one file; split into `src/components/profile/*` only if it passes ~350 lines):

1. **Header block:** `<Avatar size={72} />`, name, email, "Joined <Month YYYY>" from `user.createdAt` via `toLocaleDateString(undefined, { month: 'short', year: 'numeric' })`.

2. **`ProfileDetailsForm`** (`.glass-card`, `<form onSubmit>`):
   - State: `name`, `avatarUrl` (initialised from `user`, re-synced in a `useEffect` on `user`), `saving`, `errors: string[]`, `message`.
   - `dirty = name.trim() !== user.name || (avatarUrl.trim() || null) !== (user.avatarUrl ?? null)`.
   - Client validation: name 1–100 after trim; avatar empty or `https://` + `new URL()` parses + ≤2048.
   - Submit builds a body of only changed fields (empty avatar → `null`), calls `usersApi.updateProfile`, then `await refreshProfile()`, shows "Profile updated".
   - Email shown as read-only text, not an input.
   - Buttons: Cancel (`btn-outline`, resets) and Save changes (`btn-primary`, disabled when `!dirty || saving`).

3. **`ChangePasswordForm`** (`.glass-card`):
   - State: `currentPassword`, `newPassword`, `confirmPassword`, `saving`, `errors`, `message`.
   - Client validation: current required; new 8–72; new ≠ current; confirm === new. If invalid, show errors and don't call the API.
   - On success: clear all three fields, show "Password updated".
   - Inputs: `type="password"`, `autoComplete="current-password"` / `"new-password"`, each with a `<label htmlFor>`.

4. **`OrganizationsList`** (`.table-container` + `.data-table`):
   - Columns: Name, Slug (`/slug`), Role (`<RoleBadge />`), Joined (`joinedAt`), Action.
   - Action: "Active" text for `activeTenant?.id`, otherwise `btn btn-outline btn-sm` "Switch" calling `switchTenant(org.id)`; track `switchingOrgId` to show `Loader2` and disable other Switch buttons.
   - Empty state: "You're not a member of any organization yet." with a "Create organization" button opening `CreateOrganizationModal` (local `isCreateOrgOpen` state).

Success messages auto-clear with a `setTimeout` of 4000ms, cleared in the effect cleanup.

### F5. Route

**File:** `frontend/src/App.tsx` — import `ProfilePage` and add inside the `AppLayout` route group:

```tsx
<Route path="/profile" element={<ProfilePage />} />
```

### F6. Header entry point

**File:** `frontend/src/components/layout/AppLayout.tsx`

- Replace the inline 34px initial `<div>` with:

```tsx
<Link to="/profile" aria-label="Your profile" title="Your profile" className="profile-avatar-link">
  <Avatar name={user?.name} avatarUrl={user?.avatarUrl} />
</Link>
```

- Remove the now-unused `UserIcon` import if `Avatar` owns it (oxlint flags unused imports).

### F7. Styles

**File:** `frontend/src/index.css` — add:

- `.avatar` (circle, `object-fit: cover`, border `var(--border-color)`, `background: var(--bg-tertiary)`, centred initial in `var(--accent-primary)`).
- `.profile-avatar-link` (no underline, `border-radius: 50%`, visible `:focus-visible` outline using `var(--accent-primary)`).
- `.profile-grid` (single column, `gap: 24px`, `max-width: 820px`).
- `.profile-header` (flex, gap 20px, name truncates with `text-overflow: ellipsis`).

---

## 4. Verification

### Backend unit tests — `backend/src/users/users.service.spec.ts`

Set up with `Test.createTestingModule({ providers: [UsersService, { provide: PrismaService, useValue: prismaMock }] })`, where `prismaMock.user = { findUnique: jest.fn(), update: jest.fn() }`. Use a real `bcrypt.hash('OldPassw0rd', 4)` in fixtures to keep tests fast.

| Test | Asserts |
|---|---|
| updateProfile updates caller only | `update` called with `where: { id: 'user-a' }`; result has no `passwordHash` |
| updateProfile `{}` | throws `BadRequestException`; `update` not called |
| updateProfile `avatarUrl: null` | `update` data is `{ avatarUrl: null }` |
| updateProfile missing user | throws `NotFoundException` |
| changePassword happy path | `bcrypt.compare(newPassword, savedHash)` is true |
| changePassword wrong current | throws `BadRequestException('Current password is incorrect')`; `update` not called |
| changePassword same password | throws `BadRequestException`; `update` not called |

**DTO tests — `backend/src/users/dto/users.dto.spec.ts`** using `plainToInstance` + `validate(obj, { whitelist: true, forbidNonWhitelisted: true })`:

- Cross-user/tenant attempt `{ id: 'user-b', tenantId: 'org-b', email: 'x@y.z', name: 'x' }` → errors on `id`, `tenantId`, `email` (**the isolation test that must fail**).
- `name: '   '` → invalid after trim; `name` of 101 chars → invalid.
- `avatarUrl: 'http://x.com/a.png'`, `'javascript:alert(1)'` → invalid; `null` → valid.
- `newPassword` of 7 and 73 chars → invalid; 8 and 72 → valid.

Run: `cd backend && npm test`.

### Backend manual checks (curl or Swagger)

```bash
TOKEN=<access token from /auth/login>
API=http://localhost:3000/api/v1

curl -s -X PATCH $API/users/me -H "Content-Type: application/json" -d '{"name":"x"}'                       # 401
curl -s -X PATCH $API/users/me -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'   # 400
curl -s -X PATCH $API/users/me -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":" New Name "}'   # 200, name "New Name", no x-tenant-id needed
curl -s -X PATCH $API/users/me -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"email":"a@b.c"}'       # 400 property email should not exist
curl -s -X PATCH $API/users/me/password -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"currentPassword":"wrong","newPassword":"NewPassw0rd"}'   # 400
```

Then change the password for real and confirm `/auth/login` fails with the old one and succeeds with the new one.

### Frontend manual checks

The seven steps in spec §8 (avatar link, name save updates header, avatar set/broken/clear, wrong current password stays logged in, confirm mismatch sends no request, switch org, no-org user empty state).

### Gates

```bash
cd backend  && npm run build && npm test
cd frontend && npm run build && npm run lint
```

(`backend npm run lint` is broken repo-wide per `CLAUDE.md`; not a gate here.)

---

## 5. Suggested commit sequence

Kept small so each one builds on its own:

1. `feat(users): add avatarUrl to User` — B1 (schema + migration).
2. `feat(users): profile and password endpoints` — B2–B5.
3. `fix(organizations): return membershipId in user org list` — B6.
4. `test(users): service and DTO tests for profile endpoints` — tests.
5. `feat(frontend): profile types, API wrapper and Avatar component` — F1–F3.
6. `feat(frontend): profile page and header link` — F4–F7.

---

## 6. File checklist

**Backend**
- [ ] M `backend/prisma/schema.prisma`
- [ ] A `backend/prisma/migrations/<ts>_profile_page/migration.sql` (generated)
- [ ] A `backend/src/users/dto/update-profile.dto.ts`
- [ ] A `backend/src/users/dto/change-password.dto.ts`
- [ ] M `backend/src/users/users.service.ts`
- [ ] A `backend/src/users/users.controller.ts`
- [ ] M `backend/src/users/users.module.ts`
- [ ] M `backend/src/organizations/organizations.service.ts`
- [ ] A `backend/src/users/users.service.spec.ts`
- [ ] A `backend/src/users/dto/users.dto.spec.ts`

**Frontend**
- [ ] M `frontend/src/types/index.ts`
- [ ] A `frontend/src/api/users.ts`
- [ ] A `frontend/src/utils/apiError.ts`
- [ ] A `frontend/src/components/common/Avatar.tsx`
- [ ] A `frontend/src/pages/ProfilePage.tsx`
- [ ] M `frontend/src/App.tsx`
- [ ] M `frontend/src/components/layout/AppLayout.tsx`
- [ ] M `frontend/src/index.css`

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Migration run against the production Neon DB | Use a Neon dev branch in `DIRECT_URL` before `migrate dev`. Column is nullable and additive, so it is safe either way. |
| Wrong-password 401 logs the user out | Service throws 400 (B4); covered by a unit test and a manual check. |
| Hotlinked avatar URLs leak viewer IPs to third-party hosts | Accepted for v1 (https only); revisit with upload in a later feature (open question 6). |
| Stolen refresh token survives a password change | Known limitation (decision 2); track as a follow-up with a `tokenVersion` column. |
| `UsersModule` importing `AuthModule` creates a circular import | Import only the `JwtAuthGuard` class, never `AuthModule` (B5). |
