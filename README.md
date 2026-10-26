# TenantFlow — Multi-Tenant SaaS Project Management Platform

**TenantFlow** is an enterprise-grade multi-tenant SaaS Project Management platform engineered with NestJS, TypeScript, Prisma ORM, and Neon Cloud PostgreSQL.

---

## 📁 Repository Folder Architecture

```text
TenantFlow-Multi-Tenant-Project-Management/
├── README.md
├── .gitignore
└── backend/
    ├── src/
    │   ├── common/
    │   │   └── filters/
    │   ├── health/
    │   ├── prisma/
    │   ├── app.module.ts
    │   └── main.ts
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── nest-cli.json
    ├── package.json
    ├── tsconfig.json
    └── tsconfig.build.json
```

---

## 🏗️ Core Architecture & Multi-Tenancy Strategy

TenantFlow utilizes a **Shared Database + Shared Schema** architecture with strict tenant isolation enforced at the service and database layers.

```text
                    TenantFlow Client
                            │
                       NestJS API (backend/)
                            │
                    Prisma ORM Client
                            │
                            ▼
                    Neon PostgreSQL
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
     Tenant A            Tenant B            Tenant C
  (organization_id)   (organization_id)   (organization_id)
```

- **Tenancy Boundary:** Every tenant-owned entity includes a mandatory `tenant_id` (mapping to an `Organization`).
- **Tenant Context:** Requests are authenticated via JWTs, from which the user and active organization membership are determined.
- **Data Leakage Defense:** Queries require both entity ID and `tenant_id`. Cross-tenant data leaks are strictly prevented.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Backend Framework** | NestJS 10 (TypeScript) |
| **Database** | Neon Cloud PostgreSQL |
| **ORM** | Prisma 6 |
| **Authentication** | JWT (AccessToken + RefreshToken) |
| **Validation** | `class-validator` & `class-transformer` |
| **Documentation** | Swagger / OpenAPI 3.0 (`/api/docs`) |
| **Cache & Queues** *(Phase 9-10)* | Redis & BullMQ |

---

## 🚀 Setup & Execution Instructions

All backend code and commands execute from within the `backend/` directory.

### 1. Change Directory to `backend/`
```bash
cd backend
```

### 2. Environment Setup
Copy `.env.example` to `.env` inside `backend/` and configure your credentials:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` (pooled) and `DIRECT_URL` (direct migration link) are configured to your Neon PostgreSQL connection string.

### 3. Installation & Prisma Generation
```bash
npm install
npx prisma generate
```

### 4. Database Migrations
```bash
npx prisma migrate deploy
```

### 5. Running the Backend Application
```bash
# Development mode
npm run dev

# Production build & start
npm run build
npm run start:prod
```

### 6. Accessing API & Documentation
- **API Base Route:** `http://localhost:3000/api/v1`
- **Health Check Endpoint:** `http://localhost:3000/api/v1/health`
- **Interactive Swagger Docs:** `http://localhost:3000/api/docs`

---

## 🔒 Security Principles
1. **Zero-Trust Frontend:** Never trust `tenant_id` sent in request query params or body without backend context validation.
2. **Environment Protection:** Secrets are never hardcoded and `.env` files are strictly git-ignored.
3. **Global Exception Handling:** Standardized error responses prevent raw stack trace leakage to clients.