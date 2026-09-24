# coopms — Cooperative Management System

[![CI](https://github.com/maibroda/coopms/actions/workflows/ci.yml/badge.svg)](https://github.com/maibroda/coopms/actions/workflows/ci.yml)

A Next.js + TypeScript + PostgreSQL app for running a staff cooperative: member savings,
loans, product sales, payroll deductions, maker-checker approvals, audit logging, member
self-service, bulk Excel import/export, and an ERP integration API.

## Stack

- Next.js 15 (App Router, Server Actions)
- TypeScript
- Prisma ORM (`@prisma/adapter-pg`) + PostgreSQL 16
- Tailwind CSS
- vitest (unit + integration tests)

## Prerequisites

- Node.js 20+
- Docker (for a local Postgres instance), or an existing PostgreSQL 16 server

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start PostgreSQL** (skip if you already have a server running)

   ```bash
   docker run -d --name coopms-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
   ```

   If the container already exists but is stopped, start it with `docker start coopms-db`.

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — Postgres connection string (defaults match the `docker run` command above).
   - `AUTH_SECRET` — session-signing secret; generate one with `openssl rand -base64 48`.

4. **Run migrations and seed demo data**

   ```bash
   npm run db:setup
   ```

   This applies all migrations and seeds 35 demo members, loans, product sales, and nine
   months of posted payroll history (Jan–Sep 2026). Demo logins (password `Password123!`):

   | Email | Role |
   |---|---|
   | `admin@coop.test` | Admin |
   | `treasurer@coop.test` | Treasurer |
   | `member1@coop.test` | Member (self-service) |

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) and sign in with one of the demo
   accounts above.

## Testing

Tests run against a separate `coopms_test` database so they never touch your dev data.

1. Add a `.env.test` pointing `DATABASE_URL` at a `coopms_test` database (same Postgres
   server, different database name works fine).
2. Run the suite:

   ```bash
   npm test
   ```

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Run the vitest suite once |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run db:migrate:dev` | Create/apply a new migration in development |
| `npm run db:migrate` | Apply pending migrations (production/CI) |
| `npm run db:seed` | Re-seed demo data (destructive — truncates first) |
| `npm run db:reset` | Drop, recreate, migrate and seed the database |

## Project layout

```
prisma/            schema, migrations, seed script
src/app/            routes (App Router) — (app) authenticated area, (auth) login/signup, api/ REST + export endpoints
src/components/     UI components and forms
src/lib/            business logic (src/lib/services), auth, calculations, shared utilities
tests/              unit tests and DB-backed integration tests
```

## Notes

- Password reset emails are not wired to a real mail provider — in development the reset
  link is printed to the server console instead of being sent.
- Dividend calculation is intentionally out of scope until payout criteria are finalized;
  bank account details are already captured on each member for when that's ready.
