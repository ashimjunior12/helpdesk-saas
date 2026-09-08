# Helpdesk SaaS

Multi-tenant, real-time customer support / helpdesk platform.

Modular monolith backend (Node.js + Express + TypeScript + MongoDB) and a
Next.js frontend. Built feature-by-feature; see `docs/development/` for the
living project state, decisions, and phase roadmap.

## Repository layout

```
helpdesk-saas/
├── backend/          # Express + TypeScript API (modular monolith)
│   └── src/
│       ├── config/       # env validation, database connection
│       ├── middleware/   # request context, error handling
│       ├── modules/      # feature modules (health, ...)
│       ├── utils/        # logger, AppError, asyncHandler
│       └── app.ts        # Express app wiring
├── frontend/         # Next.js (App Router) + TypeScript
└── docs/development/ # persistent project memory
```

## Tech stack

Backend: Node.js, Express, TypeScript, MongoDB (Mongoose), Zod, Pino.
Frontend: React, Next.js, TypeScript.
Planned (later phases): Socket.IO, Redis, BullMQ, Docker.

## Prerequisites

- Node.js 20+ (developed on Node 22)
- MongoDB running locally (or a connection string)

## Getting started

### Backend

```bash
cd backend
cp .env.example .env        # then edit values as needed
npm install
npm run dev                 # http://localhost:4000
```

Verify the API is up:

```bash
curl http://localhost:4000/api/health
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## Scripts

Backend (`/backend`):

| Script            | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start API with hot reload (tsx)      |
| `npm run build`   | Compile TypeScript to `dist/`        |
| `npm start`       | Run compiled server                  |
| `npm run typecheck` | Type-check without emitting        |
| `npm run lint`    | ESLint                               |
| `npm test`        | Jest (integration tests)             |

Frontend (`/frontend`): `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

## Status

Phase 0 — Project Foundation. Authentication and business features are not yet
implemented. See `docs/development/TODO.md` for the roadmap.
