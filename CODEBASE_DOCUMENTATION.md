# TenantFlow Codebase Documentation

This document provides a comprehensive file-by-file reference for the **TenantFlow** Multi-Tenant SaaS Project Management backend codebase.

---

## 1. Core Application Setup & Database Configuration

### `backend/prisma/schema.prisma`
- **Location**: `backend/prisma/schema.prisma`
- **Purpose**: Definitive Prisma ORM database schema specifying models, indexes, relations, and enums.
- **Key Entities**:
  - `User`: User accounts with credentials hash.
  - `Organization`: Tenant organization entity.
  - `Membership`: User-to-Organization relationship storing organization-specific `Role`.
  - `Project`: Tenant-isolated projects.
  - `Task`: Tenant-isolated tasks referencing projects and assignees.
  - `AuditLog`: Immutable audit trail for security and system events.

### `backend/src/main.ts`
- **Location**: `backend/src/main.ts`
- **Purpose**: Application entry point initializing NestJS runtime.
- **Functionality**:
  - Sets global API prefix `/api`.
  - Enables `ValidationPipe` with DTO transformation and whitelist protection.
  - Configures global CORS headers.
  - Configures Swagger/OpenAPI documentation at `/api/docs`.

### `backend/src/app.module.ts`
- **Location**: `backend/src/app.module.ts`
- **Purpose**: Root module registering configuration and feature modules.
- **Modules Registered**: `ConfigModule`, `PrismaModule`, `HealthModule`, `UsersModule`, `AuthModule`, `OrganizationsModule`, `TenantModule`, `PermissionsModule`, `ProjectsModule`, `TasksModule`, `AuditModule`.

### `backend/src/prisma/prisma.service.ts`
- **Location**: `backend/src/prisma/prisma.service.ts`
- **Purpose**: Database provider extending PrismaClient lifecycle.
- **Functionality**: Manages database connection pool on NestJS application startup (`onModuleInit`) and graceful teardown (`onModuleDestroy`).

### `backend/src/prisma/prisma.module.ts`
- **Location**: `backend/src/prisma/prisma.module.ts`
- **Purpose**: Global module exporting `PrismaService` to enable dependency injection across all feature services.

---

## 2. Common Infrastructure & Utilities

### `backend/src/common/filters/http-exception.filter.ts`
- **Location**: `backend/src/common/filters/http-exception.filter.ts`
- **Purpose**: Global exception filter for unified REST API error responses.
- **Functionality**: Intercepts unhandled HTTP exceptions and formats responses into structured JSON (`statusCode`, `message`, `error`, `timestamp`, `path`).

### `backend/src/common/decorators/current-user.decorator.ts`
- **Location**: `backend/src/common/decorators/current-user.decorator.ts`
- **Purpose**: Custom parameter decorator for extracting authenticated JWT user payload.
- **Functionality**: Extracts `request.user` attached by `JwtAuthGuard` into controller methods.

### `backend/src/health/health.controller.ts`
- **Location**: `backend/src/health/health.controller.ts`
- **Purpose**: System health and readiness endpoint (`GET /health`).
- **Functionality**: Performs liveness checks and database ping to report status.

### `backend/src/health/health.module.ts`
- **Location**: `backend/src/health/health.module.ts`
- **Purpose**: Module grouping health controller endpoints.

---

## 3. Authentication & User Management

### `backend/src/auth/auth.controller.ts`
- **Location**: `backend/src/auth/auth.controller.ts`
- **Purpose**: REST controller handling authentication lifecycle endpoints.
- **Endpoints**:
  - `POST /auth/register`: Account registration.
  - `POST /auth/login`: User authentication returning JWT tokens.
  - `POST /auth/refresh`: Token rotation endpoint.
  - `POST /auth/logout`: Revokes active refresh session.
  - `GET /auth/me`: Fetches authenticated user profile.

### `backend/src/auth/auth.service.ts`
- **Location**: `backend/src/auth/auth.service.ts`
- **Purpose**: Business logic for token generation, password hashing (argon2/bcrypt), and session validation.

### `backend/src/auth/auth.module.ts`
- **Location**: `backend/src/auth/auth.module.ts`
- **Purpose**: Configures Passport, JwtModule, authentication strategies, and exports `AuthService`.

### `backend/src/auth/strategies/jwt.strategy.ts`
- **Location**: `backend/src/auth/strategies/jwt.strategy.ts`
- **Purpose**: Passport strategy for validating Bearer Access Tokens.

### `backend/src/auth/strategies/jwt-refresh.strategy.ts`
- **Location**: `backend/src/auth/strategies/jwt-refresh.strategy.ts`
- **Purpose**: Passport strategy for validating Refresh Tokens during token rotation.

### `backend/src/auth/guards/jwt-auth.guard.ts`
- **Location**: `backend/src/auth/guards/jwt-auth.guard.ts`
- **Purpose**: Guard enforcing access token authentication on protected endpoints.

### `backend/src/auth/guards/jwt-refresh.guard.ts`
- **Location**: `backend/src/auth/guards/jwt-refresh.guard.ts`
- **Purpose**: Guard enforcing refresh token authentication for token refresh endpoints.

### `backend/src/auth/dto/register.dto.ts`
- **Location**: `backend/src/auth/dto/register.dto.ts`
- **Purpose**: DTO validating registration input fields (`email`, `password`, `name`).

### `backend/src/auth/dto/login.dto.ts`
- **Location**: `backend/src/auth/dto/login.dto.ts`
- **Purpose**: DTO validating login credentials (`email`, `password`).

### `backend/src/auth/dto/refresh-token.dto.ts`
- **Location**: `backend/src/auth/dto/refresh-token.dto.ts`
- **Purpose**: DTO validating token refresh request payload.

### `backend/src/users/users.service.ts`
- **Location**: `backend/src/users/users.service.ts`
- **Purpose**: User entity database helper methods (create user, find by email, find by ID).

### `backend/src/users/users.module.ts`
- **Location**: `backend/src/users/users.module.ts`
- **Purpose**: Module encapsulating user management capabilities.

---

## 4. Multi-Tenant Context & Isolation Engine

### `backend/src/tenant/tenant.service.ts`
- **Location**: `backend/src/tenant/tenant.service.ts`
- **Purpose**: Validates tenant membership and membership roles.
- **Functionality**: `validateTenantMembership(userId, tenantId)` checks if user is an active member of target organization and returns membership detail.

### `backend/src/tenant/guards/tenant.guard.ts`
- **Location**: `backend/src/tenant/guards/tenant.guard.ts`
- **Purpose**: Security guard resolving and validating active tenant context on incoming HTTP requests.
- **Functionality**: Resolves `tenantId` from `x-tenant-id` header, route param, or JWT token; verifies user membership; attaches `request.tenant = { tenantId, role }`.

### `backend/src/tenant/decorators/current-tenant.decorator.ts`
- **Location**: `backend/src/tenant/decorators/current-tenant.decorator.ts`
- **Purpose**: Custom decorator supplying `@CurrentTenant()` context into controller parameters.

### `backend/src/tenant/tenant.module.ts`
- **Location**: `backend/src/tenant/tenant.module.ts`
- **Purpose**: Module exporting `TenantService` and `TenantGuard`.

---

## 5. RBAC & Fine-Grained Permissions Engine (Phase 6)

### `backend/src/permissions/permissions.enum.ts`
- **Location**: `backend/src/permissions/permissions.enum.ts`
- **Purpose**: Enum defining system permissions (`ORG_READ`, `PROJECT_CREATE`, `TASK_UPDATE`, etc.).

### `backend/src/permissions/role-permissions.map.ts`
- **Location**: `backend/src/permissions/role-permissions.map.ts`
- **Purpose**: Matrix mapping organization roles (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`) to allowed `Permission` arrays.

### `backend/src/permissions/decorators/require-permissions.decorator.ts`
- **Location**: `backend/src/permissions/decorators/require-permissions.decorator.ts`
- **Purpose**: Metadata decorator `@RequirePermissions(...permissions)` specifying permission requirements for endpoint handlers.

### `backend/src/permissions/decorators/require-roles.decorator.ts`
- **Location**: `backend/src/permissions/decorators/require-roles.decorator.ts`
- **Purpose**: Metadata decorator `@RequireRoles(...roles)` specifying role requirements for endpoint handlers.

### `backend/src/permissions/guards/permissions.guard.ts`
- **Location**: `backend/src/permissions/guards/permissions.guard.ts`
- **Purpose**: Guard enforcing that the authenticated user's tenant role grants all requested `@RequirePermissions`.

### `backend/src/permissions/guards/roles.guard.ts`
- **Location**: `backend/src/permissions/guards/roles.guard.ts`
- **Purpose**: Guard enforcing that the authenticated user's tenant role matches `@RequireRoles`.

### `backend/src/permissions/permissions.module.ts`
- **Location**: `backend/src/permissions/permissions.module.ts`
- **Purpose**: Module exporting authorization guards for use across feature modules.

---

## 6. Organizations & Membership Module

### `backend/src/organizations/organizations.controller.ts`
- **Location**: `backend/src/organizations/organizations.controller.ts`
- **Purpose**: REST endpoints for tenant organization lifecycle.
- **Endpoints**:
  - `POST /organizations`: Create organization (creator becomes `OWNER`).
  - `GET /organizations`: List organizations current user belongs to.
  - `GET /organizations/:id`: Get organization details.
  - `PATCH /organizations/:id`: Update organization details (`OWNER`/`ADMIN`).
  - `GET /organizations/:id/members`: List organization members.
  - `POST /organizations/:id/members`: Add new member by email.
  - `PATCH /organizations/:id/members/:memberId`: Update member role.
  - `DELETE /organizations/:id/members/:memberId`: Remove member.
  - `POST /organizations/:id/switch`: Switch active organization context and receive tenant-scoped JWT.

### `backend/src/organizations/organizations.service.ts`
- **Location**: `backend/src/organizations/organizations.service.ts`
- **Purpose**: Business logic and database operations for tenant organizations and user memberships.

### `backend/src/organizations/organizations.module.ts`
- **Location**: `backend/src/organizations/organizations.module.ts`
- **Purpose**: Module registering organization controller and service.

### DTO Files:
- `backend/src/organizations/dto/create-organization.dto.ts`: Validates name and unique slug.
- `backend/src/organizations/dto/update-organization.dto.ts`: Validates update input.
- `backend/src/organizations/dto/add-member.dto.ts`: Validates member addition email and role.
- `backend/src/organizations/dto/update-member-role.dto.ts`: Validates role updates.

---

## 7. Projects Management Module (Phase 7)

### `backend/src/projects/projects.controller.ts`
- **Location**: `backend/src/projects/projects.controller.ts`
- **Purpose**: REST controller for project CRUD operations.
- **Endpoints**:
  - `POST /projects`: Create project (`PROJECT_CREATE`).
  - `GET /projects`: List tenant projects with search and pagination (`PROJECT_READ`).
  - `GET /projects/:id`: Get project details (`PROJECT_READ`).
  - `PATCH /projects/:id`: Update project details (`PROJECT_UPDATE`).
  - `DELETE /projects/:id`: Delete project (`PROJECT_DELETE`).

### `backend/src/projects/projects.service.ts`
- **Location**: `backend/src/projects/projects.service.ts`
- **Purpose**: Encapsulates project database logic enforcing strict tenant isolation (`where: { id, tenantId }`).

### `backend/src/projects/projects.module.ts`
- **Location**: `backend/src/projects/projects.module.ts`
- **Purpose**: Module registering project management resources.

### DTO Files:
- `backend/src/projects/dto/create-project.dto.ts`: Validates project name & description.
- `backend/src/projects/dto/update-project.dto.ts`: Partial DTO for updates.
- `backend/src/projects/dto/query-project.dto.ts`: Pagination (`page`, `limit`) and search query parameters.

---

## 8. Tasks Management Module (Phase 8)

### `backend/src/tasks/tasks.controller.ts`
- **Location**: `backend/src/tasks/tasks.controller.ts`
- **Purpose**: REST controller for task management.
- **Endpoints**:
  - `POST /projects/:projectId/tasks`: Create task in project (`TASK_CREATE`).
  - `GET /projects/:projectId/tasks`: List tasks in specific project (`TASK_READ`).
  - `GET /tasks`: List all tasks in tenant with status/priority/assignee filters (`TASK_READ`).
  - `GET /tasks/:id`: Get task details (`TASK_READ`).
  - `PATCH /tasks/:id`: Update task (`TASK_UPDATE`).
  - `DELETE /tasks/:id`: Delete task (`TASK_DELETE`).

### `backend/src/tasks/tasks.service.ts`
- **Location**: `backend/src/tasks/tasks.service.ts`
- **Purpose**: Business logic for task management; enforces cross-tenant boundary validation (verifying project and assignee belong to current tenant).

### `backend/src/tasks/tasks.module.ts`
- **Location**: `backend/src/tasks/tasks.module.ts`
- **Purpose**: Module registering task controllers and services.

### DTO Files:
- `backend/src/tasks/dto/create-task.dto.ts`: Validates title, status, priority, and assignee UUID.
- `backend/src/tasks/dto/update-task.dto.ts`: Partial DTO for task updates.
- `backend/src/tasks/dto/query-task.dto.ts`: Filters by `status`, `priority`, `assigneeId`, `projectId`, and `search`.

---

## 9. Audit Logging Engine (Phase 12)

### `backend/src/audit/audit.controller.ts`
- **Location**: `backend/src/audit/audit.controller.ts`
- **Purpose**: Endpoint for listing tenant audit trail.
- **Endpoint**: `GET /audit-logs`: Fetches paginated audit logs for active tenant (`AUDIT_READ`).

### `backend/src/audit/audit.service.ts`
- **Location**: `backend/src/audit/audit.service.ts`
- **Purpose**: Logging service providing `logAction(...)` helper and paginated audit query builder.

### `backend/src/audit/audit.module.ts`
- **Location**: `backend/src/audit/audit.module.ts`
- **Purpose**: Global module exporting `AuditService`.

### `backend/src/audit/dto/query-audit.dto.ts`
- **Location**: `backend/src/audit/dto/query-audit.dto.ts`
- **Purpose**: Validates query filters (`page`, `limit`, `action`, `entity`).
