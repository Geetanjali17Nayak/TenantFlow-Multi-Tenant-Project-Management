# TenantFlow — Production-Style Multi-Tenant SaaS

## 1. Project Overview

TenantFlow is a production-style, multi-tenant SaaS Project Management platform designed to demonstrate strong full-stack and backend engineering skills.

The project is intentionally more than a CRUD application. It should demonstrate:

- React/Next.js frontend architecture
- NestJS backend architecture
- TypeScript
- PostgreSQL
- Neon cloud PostgreSQL
- Prisma ORM
- JWT authentication
- Refresh-token security
- Multi-tenancy
- Tenant isolation
- RBAC and permissions
- REST APIs
- Redis caching
- BullMQ background jobs
- PostgreSQL Row Level Security
- Transactions
- Database indexing and query optimization
- Rate limiting
- Audit logging
- Subscription/plan limits
- Testing
- Observability
- Docker
- CI/CD-ready structure
- Production-oriented security
- Scalable architecture

The goal is to build something that can be discussed deeply in backend/full-stack interviews.

---

# 2. Product Vision

TenantFlow is a lightweight Jira/Linear-style project management SaaS.

A user can:

1. Register and log in.
2. Belong to multiple organizations.
3. Switch between organizations.
4. See only data belonging to the active organization.
5. Have different roles in different organizations.
6. Create and manage projects according to permissions.
7. Create, assign, update, and complete tasks.
8. Receive notifications.
9. View organization activity/audit history.
10. Operate within subscription-plan limits.

Example:

```text
User: Geetanjali

Organization: Acme
Role: ADMIN

Organization: XYZ
Role: MEMBER
```

The role belongs to the membership, not the user.

---

# 3. High-Level Architecture

```text
                           ┌─────────────────────┐
                           │      Browser        │
                           │ Next.js Frontend    │
                           └──────────┬──────────┘
                                      │
                              HTTPS / REST
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │    NestJS API       │
                           │                     │
                           │ Auth                │
                           │ Tenant Context      │
                           │ RBAC                │
                           │ Projects            │
                           │ Tasks               │
                           │ Organizations       │
                           │ Billing/Plans       │
                           │ Audit               │
                           └──────┬───────┬──────┘
                                  │       │
                              Prisma    Redis
                                  │       │
                                  ▼       ▼
                     ┌─────────────────┐  ┌──────────────┐
                     │ Neon PostgreSQL │  │    Redis     │
                     │                 │  │              │
                     │ Tenant data     │  │ Cache        │
                     │ RLS             │  │ BullMQ       │
                     │ Audit logs      │  │ Rate limits  │
                     └─────────────────┘  └──────┬───────┘
                                                  │
                                                  ▼
                                           Background Workers
```

---

# 4. Monorepo Structure

Use a monorepo so frontend and backend can evolve together.

Recommended structure:

```text
tenant-flow/
│
├── apps/
│   ├── web/                         # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── services/
│   │   │   ├── stores/
│   │   │   ├── types/
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── api/                         # NestJS backend
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── organizations/
│       │   ├── memberships/
│       │   ├── tenant/
│       │   ├── permissions/
│       │   ├── projects/
│       │   ├── tasks/
│       │   ├── notifications/
│       │   ├── audit/
│       │   ├── billing/
│       │   ├── health/
│       │   ├── prisma/
│       │   ├── common/
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── test/
│       ├── package.json
│       └── ...
│
├── packages/
│   ├── shared-types/                # Shared TypeScript types
│   ├── eslint-config/
│   └── tsconfig/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   └── decisions/
│
├── docker/
│   └── ...
│
├── .env
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── README.md
└── ...
```

Do not create every feature module immediately. Build incrementally by phase.

---

# 5. Technology Stack

## Frontend

Use:

- Next.js
- React
- TypeScript
- CSS modules or a clean CSS architecture
- React Hook Form
- Zod
- TanStack Query where useful
- Accessible UI components
- Responsive design

Avoid unnecessary frontend libraries.

The frontend should consume the NestJS REST API rather than implementing backend business logic itself.

## Backend

Use:

- NestJS
- TypeScript
- PostgreSQL
- Neon PostgreSQL
- Prisma
- JWT
- Argon2 or bcrypt
- Redis
- BullMQ
- class-validator
- class-transformer
- Swagger/OpenAPI
- Jest
- Supertest

## Infrastructure

Use:

- Neon PostgreSQL
- Redis
- Docker
- Docker Compose
- GitHub Actions-ready structure

---

# 6. Cloud Database

A Neon PostgreSQL database has already been created.

The real connection string is stored in the local `.env` file.

Use:

```env
DATABASE_URL="existing-neon-connection-string"
```

Never hardcode the connection string.

Never print the secret in logs.

Never commit `.env`.

`.env.example` must contain placeholders only:

```env
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"

JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"

REDIS_URL="redis://localhost:6379"

NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

Do not manually create application tables in Neon.

Use Prisma migrations:

```bash
npx prisma migrate dev --name init
```

Production:

```bash
npx prisma migrate deploy
```

Never run:

```bash
npx prisma migrate reset
```

against the cloud database without explicit approval.

---

# 7. Database Architecture

Use:

**Shared Database + Shared Schema + tenant_id**

Tenant-owned resources must be associated with a tenant.

Important conceptual distinction:

- `organization` = tenant
- `membership` = relationship between user and tenant
- `tenant_id` = organization ID used for tenant-owned records

Do not create a separate database for every organization.

---

# 8. Core Database Entities

Initial entities:

```text
User
Organization
Membership
Project
Task
AuditLog
Notification
RefreshToken
```

Later entities may include:

```text
Subscription
Plan
Usage
Invitation
Comment
Attachment
```

---

# 9. User Model

Fields:

```text
id
email
password_hash
name
avatar_url
created_at
updated_at
```

Requirements:

- Email must be unique.
- Password must never be returned by APIs.
- Passwords must be hashed.
- Never log password values.

---

# 10. Organization Model

Fields:

```text
id
name
slug
created_at
updated_at
```

Requirements:

- Slug should be unique.
- Organization is the tenant.
- Organization deletion must be handled carefully because it affects tenant-owned records.

---

# 11. Membership Model

Fields:

```text
id
user_id
organization_id
role
created_at
updated_at
```

Relationship:

```text
User ←→ Membership ←→ Organization
```

A user can belong to many organizations.

An organization can have many users.

Add a unique constraint on:

```text
(user_id, organization_id)
```

A user's role is stored here.

---

# 12. Roles

Implement:

```text
OWNER
ADMIN
MANAGER
MEMBER
VIEWER
```

Role is organization-specific.

Example:

```text
Geetanjali → Acme → ADMIN
Geetanjali → XYZ  → MEMBER
```

Do not store organization role directly on `User`.

---

# 13. Project Model

Fields:

```text
id
tenant_id
name
description
created_at
updated_at
```

Every project belongs to exactly one organization.

Recommended indexes:

```text
(tenant_id)
(tenant_id, created_at)
```

Consider additional indexes based on actual query patterns.

---

# 14. Task Model

Fields:

```text
id
tenant_id
project_id
title
description
status
priority
assignee_id
created_at
updated_at
```

Status:

```text
TODO
IN_PROGRESS
DONE
```

Priority:

```text
LOW
MEDIUM
HIGH
URGENT
```

Tasks must be tenant-isolated.

The project and task tenant relationship must also be validated.

Do not allow a task from Tenant A to reference a project from Tenant B.

---

# 15. AuditLog Model

Fields:

```text
id
tenant_id
user_id
action
entity
entity_id
metadata
created_at
```

Examples:

```text
LOGIN
PROJECT_CREATED
PROJECT_UPDATED
PROJECT_DELETED
TASK_CREATED
TASK_UPDATED
MEMBER_ADDED
MEMBER_REMOVED
ROLE_CHANGED
```

Audit logs are tenant-owned data.

---

# 16. Tenant Isolation

This is the most important security requirement.

A user belonging to Tenant A must NEVER be able to access Tenant B's data unless explicitly authorized through valid membership.

Never trust:

```text
?tenantId=...
```

from the browser.

Correct request flow:

```text
Request
  ↓
JWT Authentication
  ↓
Identify User
  ↓
Determine Active Tenant
  ↓
Verify Membership
  ↓
Create Tenant Context
  ↓
Controller
  ↓
Service
  ↓
Tenant-filtered Prisma query
  ↓
PostgreSQL
```

For example:

```typescript
await prisma.project.findFirst({
  where: {
    id: projectId,
    tenantId,
  },
});
```

Do not do:

```typescript
await prisma.project.findUnique({
  where: {
    id: projectId,
  },
});
```

for a tenant-owned resource unless tenant isolation is enforced through another equally strong mechanism.

---

# 17. Tenant Context

Implement a reusable tenant context.

Possible request flow:

```text
JWT
 ↓
userId
 ↓
active tenant
 ↓
membership verification
 ↓
request.tenantId
```

Create:

```text
tenant/
├── decorators/
├── tenant.context.ts
├── tenant.guard.ts
└── tenant.module.ts
```

Use a decorator such as:

```typescript
@CurrentTenant()
tenantId: string
```

The exact implementation can use NestJS request-scoped context, AsyncLocalStorage, or another appropriate mechanism.

Explain the trade-offs before choosing.

---

# 18. Authentication

Endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

Requirements:

- Secure password hashing
- Access token
- Refresh token
- Expiration
- Rotation where appropriate
- Logout/revocation strategy
- Authentication guard
- Current-user decorator
- DTO validation

JWT may contain:

```json
{
  "sub": "user-id",
  "tenantId": "organization-id"
}
```

Do not blindly trust role claims.

Membership should be verified when required.

---

# 19. Organization Switching

A user may belong to multiple organizations.

Frontend:

```text
Organization Selector
        ↓
Select organization
        ↓
Backend verifies membership
        ↓
Active tenant changes
```

Do not let the browser arbitrarily claim membership in an organization.

Provide an appropriate backend endpoint for switching/issuing the tenant-aware session/token.

---

# 20. RBAC and Permissions

Create reusable authorization mechanisms.

Examples:

```typescript
@Roles(Role.ADMIN)
```

or:

```typescript
@Permissions(Permission.PROJECT_CREATE)
```

Do not scatter:

```typescript
if (user.role === 'ADMIN')
```

throughout the codebase.

Permission checks should be centralized and testable.

---

# 21. Project APIs

Implement:

```text
POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
```

Support:

- pagination
- sorting
- filtering
- authorization
- tenant isolation

---

# 22. Task APIs

Implement:

```text
POST   /projects/:projectId/tasks
GET    /projects/:projectId/tasks
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
```

Support:

- pagination
- filtering
- sorting
- assignment
- status changes
- priority changes
- authorization
- tenant isolation

---

# 23. Frontend Application

Use Next.js + TypeScript.

Recommended route structure:

```text
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
│
├── (dashboard)/
│   ├── dashboard/
│   ├── projects/
│   │   ├── page.tsx
│   │   ├── new/
│   │   └── [projectId]/
│   │
│   ├── tasks/
│   ├── members/
│   ├── settings/
│   └── audit-logs/
│
└── layout.tsx
```

Use feature-based components.

Example:

```text
features/
├── auth/
├── organizations/
├── projects/
├── tasks/
├── members/
├── notifications/
└── dashboard/
```

---

# 24. Frontend Pages

Implement these pages incrementally.

## Public

```text
/
 /login
 /register
 /forgot-password
```

## Authenticated

```text
/dashboard
/projects
/projects/new
/projects/[projectId]
/tasks
/members
/audit-logs
/settings
```

Later:

```text
/billing
/notifications
/profile
```

---

# 25. Frontend Dashboard

Dashboard should display:

- active organization
- project count
- task count
- tasks by status
- recent activity
- overdue tasks
- recent projects

Do not calculate sensitive or authoritative business data only on the frontend.

Dashboard data should come from backend APIs.

---

# 26. Organization Selector

Place organization switching in the main application shell.

Example:

```text
┌─────────────────────────────┐
│ TenantFlow                  │
│                             │
│ Organization: Acme ▼        │
└─────────────────────────────┘
```

When the organization changes:

1. Call backend.
2. Verify membership.
3. Update active tenant context.
4. Refresh relevant cached queries.
5. Navigate/refresh dashboard data.

Never simply change a frontend variable and assume the tenant changed securely.

---

# 27. Project UI

Project list should support:

- search
- pagination
- sorting
- project creation
- project editing
- project deletion
- project details

Example:

```text
Projects

[ Search projects... ] [ + New Project ]

Project Name      Tasks      Created      Actions
--------------------------------------------------
Website           12         Sep 20       ...
Mobile App        8          Sep 18       ...
```

---

# 28. Task UI

Provide:

- task list
- filters
- status
- priority
- assignee
- project
- pagination

Later support a Kanban-style view:

```text
TODO
----------------
Task A
Task B

IN PROGRESS
----------------
Task C

DONE
----------------
Task D
```

Do not over-engineer drag-and-drop initially.

---

# 29. API Client

Create a centralized API client.

Example:

```text
lib/
└── api-client.ts
```

Responsibilities:

- base URL
- authentication handling
- JSON parsing
- error handling
- request headers
- refresh-token flow if applicable

Do not scatter raw `fetch()` calls across every component.

---

# 30. Server State

Use TanStack Query or an equivalent well-justified approach for server state.

Benefits:

- caching
- invalidation
- loading states
- error states
- refetching

Tenant changes must invalidate/refetch tenant-specific data.

---

# 31. Frontend Security

Never assume frontend authorization is security.

The frontend can hide buttons:

```text
Delete Project
```

for a MEMBER, but the backend must still reject the API request.

Frontend:

```text
UX restriction
```

Backend:

```text
Actual security boundary
```

Never put database credentials or server secrets in `NEXT_PUBLIC_*` variables.

---

# 32. API Error Handling

Use a consistent API error format.

Example:

```json
{
  "statusCode": 403,
  "message": "You do not have permission to perform this action",
  "error": "Forbidden"
}
```

Frontend should convert API errors into useful user-facing messages.

Do not expose internal stack traces.

---

# 33. Validation

Backend:

- DTOs
- class-validator
- class-transformer
- whitelist validation
- reject unexpected fields

Frontend:

- React Hook Form
- Zod
- client-side validation for UX

Backend validation remains authoritative.

---

# 34. PostgreSQL Indexing

Design indexes around real queries.

Examples:

```text
Membership:
(user_id, organization_id)

Project:
(tenant_id)
(tenant_id, created_at)

Task:
(tenant_id)
(tenant_id, project_id)
(tenant_id, status)
```

Do not blindly index every column.

Explain:

- index purpose
- selectivity
- composite-index ordering
- read/write trade-offs

---

# 35. PostgreSQL Transactions

Use Prisma transactions when multiple operations must succeed or fail together.

Example:

Creating an organization may involve:

```text
Create organization
+
Create owner membership
```

These should be atomic where appropriate.

Explain transaction isolation and failure scenarios.

---

# 36. PostgreSQL Row Level Security

Later implement RLS as defense in depth.

Target architecture:

```text
Application tenant filtering
+
PostgreSQL RLS
```

RLS should not replace application authorization/RBAC.

Document how the application sets tenant context for PostgreSQL safely.

Be careful with connection pooling and session state.

Do not implement a naive RLS solution that can leak tenant context between pooled connections.

---

# 37. Redis

Use Redis for:

- caching
- rate limiting where appropriate
- temporary data
- BullMQ

Tenant-safe keys:

```text
tenant:{tenantId}:projects
tenant:{tenantId}:project:{projectId}
tenant:{tenantId}:dashboard
```

Never use:

```text
projects
dashboard
```

as global keys for tenant-specific data.

Implement invalidation after mutations.

Gracefully handle Redis outages.

Redis should improve performance, not become a single point of failure for basic database-backed functionality.

---

# 38. Redis Failure Strategy

If Redis goes down:

```text
Request
 ↓
Try Redis
 ↓
Redis unavailable
 ↓
Timeout quickly
 ↓
Fallback to PostgreSQL where appropriate
```

Avoid hanging requests.

Consider:

- timeouts
- circuit breaker
- logging
- alerts
- fallback
- DB protection

Do not make every endpoint completely dependent on Redis.

---

# 39. Background Jobs

Use BullMQ backed by Redis.

Potential jobs:

```text
send-email
send-notification
generate-report
process-audit
cleanup-expired-data
```

Every tenant-specific job payload must include:

```json
{
  "tenantId": "tenant-id",
  "userId": "user-id"
}
```

Workers must re-establish/validate the required context rather than assuming a previous HTTP request exists.

---

# 40. Notifications

Create a notification system later.

Examples:

```text
You were assigned a task.
A project was updated.
You were added to an organization.
```

Database:

```text
Notification
```

Potential fields:

```text
id
tenant_id
user_id
type
title
message
read_at
created_at
```

Use background jobs for expensive notification delivery.

---

# 41. Subscription Plans

Later implement:

```text
FREE
PRO
BUSINESS
```

Example limits:

```text
FREE
- 3 members
- 5 projects
- 100 tasks

PRO
- 25 members
- 50 projects
- 5,000 tasks

BUSINESS
- Higher limits
```

These are project-demo limits and can be changed later.

Enforce limits in backend services.

Do not rely on frontend checks.

---

# 42. Audit Logging

Important actions must create audit events.

Examples:

```text
LOGIN
LOGOUT
PROJECT_CREATED
PROJECT_UPDATED
PROJECT_DELETED
TASK_CREATED
TASK_UPDATED
TASK_DELETED
MEMBER_ADDED
MEMBER_REMOVED
ROLE_CHANGED
ORGANIZATION_UPDATED
```

Audit logs should capture:

```text
who
what
which entity
which tenant
when
metadata
```

Do not store passwords or sensitive secrets in audit metadata.

---

# 43. Rate Limiting

Protect:

- login
- registration
- password reset
- refresh
- expensive APIs

Use appropriate limits.

Consider both:

```text
IP-based limits
+
user/tenant-based limits
```

Do not implement arbitrary limits without documenting why they exist.

---

# 44. Health Checks

Create:

```text
GET /health
```

It should report useful health information for:

- application
- PostgreSQL
- Redis

Distinguish readiness from liveness where appropriate.

---

# 45. Observability

Implement:

- structured logs
- request IDs
- HTTP latency
- error logs
- database errors
- Redis errors
- background job failures
- health checks

Avoid logging:

- passwords
- tokens
- connection strings
- secrets

---

# 46. Testing Strategy

## Backend Unit Tests

Test:

- auth service
- project service
- task service
- permission logic
- tenant logic

## Integration Tests

Test:

- registration
- login
- organization creation
- membership
- projects
- tasks

## Security Tests

These are mandatory:

```text
Tenant A cannot access Tenant B project.
Tenant A cannot access Tenant B task.
MEMBER cannot perform ADMIN-only operation.
VIEWER cannot modify project.
Unauthenticated user cannot access protected APIs.
User cannot switch to an organization without membership.
Task cannot be assigned across tenants.
Project cannot be attached to another tenant.
```

## Frontend Tests

Test important:

- forms
- organization switching
- protected routes
- loading states
- error states
- critical user flows

---

# 47. Performance Testing

After functionality is complete, investigate:

- slow SQL queries
- Prisma query patterns
- N+1 problems
- excessive API calls
- frontend rerenders
- missing indexes
- cache hit/miss rates
- connection pool behavior
- pagination performance

Use realistic data volumes.

Discuss behavior at:

```text
10K records
100K records
1M records
```

---

# 48. Pagination

Do not load unlimited records.

Initially support:

```text
page
limit
```

Example:

```text
GET /projects?page=1&limit=20
```

Later evaluate cursor pagination for large datasets.

Explain why cursor pagination can be better for large/changing datasets.

---

# 49. API Documentation

Use Swagger/OpenAPI.

Expose:

```text
/api/docs
```

Document:

- endpoints
- DTOs
- authentication
- status codes
- error responses
- pagination
- filters

Do not expose secrets in Swagger examples.

---

# 50. Docker

Do not run PostgreSQL locally because the project uses Neon.

Docker Compose may contain:

```text
web
api
redis
```

PostgreSQL remains:

```text
Neon Cloud
```

Environment variables should configure all services.

---

# 51. Git Strategy

Use small meaningful commits.

Examples:

```text
feat: initialize tenantflow monorepo
feat: configure nestjs api
feat: configure nextjs web app
feat: configure prisma and neon postgres
feat: add initial database schema
feat: implement authentication
feat: implement organizations
feat: implement memberships
feat: implement tenant context
feat: implement rbac
feat: implement projects
feat: implement tasks
feat: add tenant isolation tests
feat: add redis caching
feat: add background jobs
feat: add audit logging
perf: optimize tenant queries
test: add security integration tests
```

Never create one huge commit for the entire project.

---

# 52. Environment Variables

Backend example:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
REDIS_URL="redis://..."
PORT=3000
```

Frontend example:

```env
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

Rules:

- `.env` stays local.
- `.env.example` contains placeholders.
- Secrets never go to Git.
- Never expose backend secrets through `NEXT_PUBLIC_*`.

---

# 53. Development Phases

Work strictly phase-by-phase.

## Phase 1 — Project Foundation

Set up:

- monorepo
- Next.js frontend
- NestJS backend
- TypeScript
- ESLint
- Prettier
- environment configuration
- Neon connection configuration
- Prisma
- Swagger
- global validation
- global exception handling
- basic health endpoint

Do not build business features.

---

## Phase 2 — Database

Create:

```text
User
Organization
Membership
Project
Task
AuditLog
```

Set up:

- relationships
- constraints
- indexes
- migrations

Verify with Prisma.

---

## Phase 3 — Authentication

Implement:

- registration
- login
- refresh
- logout
- current user
- password hashing
- JWT
- frontend auth pages

---

## Phase 4 — Organizations & Memberships

Implement:

- organization creation
- organization listing
- member management
- invitations if appropriate
- roles
- organization switcher

---

## Phase 5 — Tenant Context

Implement:

- active tenant
- membership verification
- tenant decorator/context
- tenant-aware services

---

## Phase 6 — RBAC

Implement:

- roles
- permissions
- guards
- decorators
- frontend permission-aware UI

Backend remains authoritative.

---

## Phase 7 — Projects

Implement complete project management.

Frontend:

- list
- create
- edit
- details
- delete

Backend:

- CRUD
- validation
- authorization
- tenant isolation
- pagination

---

## Phase 8 — Tasks

Implement:

- CRUD
- status
- priority
- assignee
- filters
- sorting
- pagination
- tenant isolation

---

## Phase 9 — Security Hardening

Implement:

- tenant isolation tests
- rate limiting
- secure headers
- refresh token security
- PostgreSQL RLS
- authorization hardening

---

## Phase 10 — Redis

Implement:

- caching
- invalidation
- tenant-safe keys
- graceful Redis failure
- rate limiting where appropriate

---

## Phase 11 — Background Jobs

Implement:

- BullMQ
- notification jobs
- email jobs
- cleanup jobs
- tenant-aware job payloads
- retries
- backoff
- failure handling

---

## Phase 12 — Audit & Notifications

Implement:

- audit logs
- notifications
- unread counts
- notification UI

---

## Phase 13 — Subscription Plans

Implement:

- plans
- usage
- limits
- backend enforcement

---

## Phase 14 — Testing

Implement:

- unit tests
- integration tests
- security tests
- frontend critical-flow tests

---

## Phase 15 — Performance

Analyze:

- indexes
- queries
- pagination
- caching
- N+1
- connection pooling
- API latency
- frontend performance

---

## Phase 16 — Observability

Implement:

- structured logging
- request IDs
- metrics
- health checks
- error monitoring concepts

---

## Phase 17 — Docker & Deployment

Prepare:

- Dockerfile
- Docker Compose
- production environment variables
- CI/CD-ready workflow
- deployment documentation

---

# 54. Coding Rules

1. TypeScript strictness should be enabled where practical.
2. Avoid `any`.
3. Controllers should be thin.
4. Services contain business logic.
5. DTOs validate inputs.
6. Prisma handles database access.
7. Authorization should be reusable.
8. Tenant context should be centralized.
9. Do not duplicate security logic unnecessarily.
10. Do not trust frontend authorization.
11. Do not expose secrets.
12. Do not over-engineer early.
13. Prefer readable production-quality code.
14. Use dependency injection correctly.
15. Handle errors explicitly.
16. Use transactions when atomicity is required.
17. Keep modules cohesive.
18. Avoid unnecessary dependencies.

---

# 55. Frontend UX Rules

The UI should feel like a real SaaS dashboard.

Priorities:

- clean
- responsive
- accessible
- consistent
- useful loading states
- useful empty states
- useful error states
- confirmation for destructive operations
- clear permission-based UI

Example empty state:

```text
No projects yet.

Create your first project to get started.

[ + Create Project ]
```

---

# 56. Frontend State Rules

Separate:

```text
Server state
UI state
Authentication state
Tenant state
```

Do not put everything into one global store.

Use React state for local UI state.

Use TanStack Query or equivalent for server state.

Use a small, well-justified mechanism for authentication/tenant state.

---

# 57. Frontend Loading & Error Handling

Every important API-driven page should handle:

```text
Loading
Success
Empty
Error
Unauthorized
Forbidden
```

Avoid blank screens.

Example:

```text
Loading projects...
```

rather than showing an empty project list while data is loading.

---

# 58. Security Boundary

Always remember:

```text
Frontend = user experience
Backend = security boundary
Database = defense in depth
```

A user can modify frontend requests manually.

Therefore every sensitive operation must be validated on the backend.

---

# 59. Interview Learning

For every important implementation, provide an interview section.

Example for multi-tenancy:

```text
What is multi-tenancy?
Why shared DB/shared schema?
What are separate DB and separate schema models?
What are the advantages and risks?
How does tenant isolation work?
How can cross-tenant data leakage happen?
How does RLS help?
```

For Redis:

```text
Why Redis?
Cache-aside?
What happens when Redis goes down?
How do you prevent stale data?
How do you invalidate cache?
How do tenant-safe cache keys work?
```

For PostgreSQL:

```text
What is an index?
What is a composite index?
How does query planning work?
What is connection pooling?
What are transactions?
What is isolation level?
```

For NestJS:

```text
Modules
Controllers
Providers
Dependency Injection
Guards
Interceptors
Pipes
Filters
Middleware
Request lifecycle
```

---

# 60. Antigravity Operating Instructions

You are working as a senior engineer AND mentor.

Do not build everything in one shot.

For each phase:

1. Explain the goal.
2. Explain the architecture.
3. Explain why the approach is being used.
4. Inspect the current repository.
5. Show files to create/change.
6. Implement only the current phase.
7. Run relevant checks/tests.
8. Fix issues caused by your implementation.
9. Explain important code.
10. Provide exact commands.
11. Provide API/UI testing steps.
12. Explain common mistakes.
13. Provide interview questions.
14. Update documentation if architecture changed.
15. Stop and wait for confirmation before moving to the next phase.

Never silently skip phases.

Never overwrite existing work without checking first.

Never expose secrets.

Never make destructive database changes without explicit approval.

---

# 61. Phase 1 Starting Instructions

Start ONLY with Phase 1.

First inspect:

```text
Node.js version
npm version
existing repository
existing package.json
existing NestJS setup
existing Next.js setup
.env existence
.gitignore
Prisma setup
```

Do not print the actual value of:

```text
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
REDIS_URL
```

Verify only whether required environment variables are present.

Then create/configure the initial monorepo structure.

Phase 1 must include:

```text
Next.js frontend
NestJS backend
TypeScript
ESLint
Prettier
environment configuration
Prisma
Neon PostgreSQL connection
Swagger
global validation
global exception handling
health endpoint
```

Verify that the backend can connect to the Neon PostgreSQL database.

Do NOT create business tables yet unless required to verify the connection.

Do NOT implement:

- authentication
- organizations
- memberships
- tenant context
- RBAC
- projects
- tasks
- Redis
- BullMQ
- subscriptions

during Phase 1.

At the end of Phase 1 report:

```text
1. Files created
2. Files modified
3. Commands executed
4. Services running
5. Database connection verification
6. Frontend verification
7. Backend verification
8. Tests/checks performed
9. What I learned
10. Next phase
```

Then STOP and wait for my confirmation.
