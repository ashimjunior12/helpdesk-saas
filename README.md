# Helpdesk SaaS

A multi-tenant, real-time customer support / helpdesk platform, built
feature-by-feature as a production-style backend with a modular monolith
architecture.

Companies sign up, manage their team, receive support tickets (from agents, an
API, or an embeddable widget), converse with customers in real time, keep private
internal notes, route work with automation, track SLAs, and view analytics.

## Highlights

- **Platform super admin** above all organizations: seeded from the database, provisions organizations and their admins/managers via a dedicated `/api/platform` surface and admin UI.
- **Multi-tenant** with strict per-organization isolation. Every org-owned query
  is scoped by `organizationId` derived from the authenticated token; cross-tenant
  access (including linked ids) returns `404`, never confirming existence.
- **Auth & RBAC**: stateless JWT auth (access + refresh, separate secrets),
  bcrypt password hashing, and server-enforced roles (`ADMIN` / `MANAGER` /
  `AGENT`).
- **Tickets** with a validated status state machine, per-org sequential numbers,
  priorities, and agent/team assignment.
- **Conversations** (public messages) and **internal notes** (a separate
  collection that can never leak to a customer-facing channel).
- **Real-time** over Socket.IO with JWT-authenticated sockets and tenant-scoped
  rooms; live message/ticket/notification events.
- **Notifications**, **SLA policies + breach detection**, **file attachments**,
  **search**, and **analytics**.
- **Automation** rules that triage tickets on creation.
- **Public REST API** (hashed org API keys) and an **embeddable support widget**
  (non-secret public key, own CORS).
- **Background jobs** via Redis + BullMQ, with an inline fallback so the app runs
  without Redis.
- **Observability**: Prometheus `/metrics`, liveness/readiness probes, structured
  logs with request correlation ids and secret redaction.
- **Rate limiting** on auth and public surfaces; **Docker Compose** for the whole
  stack; **CI** on every push.
- **Frontend**: a clean Next.js agent dashboard (sign-in, overview, tickets with
  live conversation and internal notes, customers) on one cohesive design system
  (light/dark), plus the embeddable support widget.

## Tech stack

Backend: Node.js, Express, TypeScript (modular monolith), MongoDB (Mongoose),
Zod, Pino, Socket.IO, Redis + BullMQ, JWT, bcryptjs, Prometheus (prom-client).
Frontend: React, Next.js (App Router), TypeScript.
Testing: Jest + Supertest (+ mongodb-memory-server, socket.io-client).

## Repository layout

```
helpdesk-saas/
├── backend/                 # Express + TypeScript API
│   └── src/
│       ├── config/          # env (Zod), database, redis
│       ├── middleware/       # requestContext, error handler, validate,
│       │                     # requireOrg/requireRole, upload, apiKeyAuth, rateLimit
│       ├── modules/          # feature modules (see below)
│       ├── queues/           # BullMQ queues + workers
│       ├── sockets/          # Socket.IO server, auth, emit registry
│       ├── observability/    # Prometheus metrics
│       ├── utils/            # logger, AppError, asyncHandler, escapeRegex
│       ├── app.ts            # wires the Express app (no I/O)
│       └── server.ts         # process entrypoint (DB, sockets, workers, shutdown)
├── frontend/                # Next.js (App Router) + the embeddable widget
├── docs/                    # WALKTHROUGH.md, SECURITY.md (committed)
├── docker-compose.yml       # mongo + redis + backend + frontend
└── .github/workflows/ci.yml # CI
```

Backend modules: `auth`, `organizations`, `users`, `teams`, `customers`,
`tickets`, `messages`, `notes`, `notifications`, `sla`, `attachments`, `search`,
`analytics`, `automation`, `apikeys`, `public`, `widget`, `health`.

## Getting started (local)

Prerequisites: Node.js 20+ (developed on 22), MongoDB running locally. Redis is
optional (background jobs run inline without it).

Backend:

```bash
cd backend
cp .env.example .env         # set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (>=32 chars)
npm install
npm run dev                  # http://localhost:4000
curl http://localhost:4000/api/health
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                  # http://localhost:3000  (widget at /widget?key=<publicKey>)
```

## Getting started (Docker)

```bash
cp .env.docker.example .env  # set JWT secrets
docker compose up --build
# frontend -> http://localhost:3001 , backend -> http://localhost:4000
```

Running via Compose includes Redis, so notifications flow through BullMQ workers
and the SLA breach job is scheduled.

## Scripts

Backend (`/backend`): `npm run dev`, `build`, `start`, `typecheck`, `lint`,
`test`, `test:coverage`, `test:ci`.
Frontend (`/frontend`): `npm run dev`, `build`, `start`, `lint`, `typecheck`.

## Documentation

- `docs/WALKTHROUGH.md` - every feature explained with the business logic behind
  it and runnable `curl` examples (the fastest way to understand the API).
- `docs/SECURITY.md` - the security posture by area, plus known gaps.

## Testing

Integration tests run the fully wired app against an in-memory MongoDB (no
external services), including Socket.IO and an end-to-end lifecycle test:

```bash
cd backend && npm test
```

## Status

All planned phases (0-22) are implemented on `main`: foundation, auth,
organizations/multi-tenancy, users/roles/teams, customers, tickets,
conversations, real-time, internal notes, notifications, Redis + BullMQ, SLA,
attachments, search, analytics, automation, public API, support widget, testing,
security, observability, and Docker/deployment.
