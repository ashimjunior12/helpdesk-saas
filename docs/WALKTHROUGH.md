# Walkthrough — Features, Business Logic & API

A running guide to what the Helpdesk SaaS does so far, why each piece exists, and
how to exercise it with `curl`. Updated as each phase lands.

- Base URL: `http://localhost:4000`
- Every response uses the standard envelope:
  - Success: `{ "success": true, "data": ... }`
  - Error: `{ "success": false, "error": { "code", "message", "details?", "requestId" } }`
- Every response includes an `x-request-id` header for tracing.

Setup (once):

```bash
cd backend
cp .env.example .env         # set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to long random values
npm install
npm run dev                  # http://localhost:4000
```

---

## Phase 0 — Foundation

**What / why.** The backbone the rest of the product is built on: a wired Express
app, MongoDB connection lifecycle, centralized errors, structured logging, and a
health probe so orchestrators and uptime checks can tell if the service is ready.

**Business logic.** The health endpoint reports `200` only when the process and
its dependencies (MongoDB) are reachable, and `503` when a dependency is down.

```bash
curl -i http://localhost:4000/api/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "development",
    "uptimeSeconds": 12,
    "timestamp": "2026-09-09T10:00:00.000Z",
    "dependencies": { "database": "up" }
  }
}
```

---

## Phase 1 — Authentication

**What / why.** Identity: users register, log in, and prove who they are on
protected routes. Every later feature needs to know who is acting.

**Business logic.**
- Passwords are hashed with bcrypt (cost 12); plaintext is never stored or logged.
- Tokens are stateless JWTs: a short-lived access token (~15m) sent as
  `Authorization: Bearer <token>`, and a longer-lived refresh token (~7d) that
  buys a fresh pair. Logout is client-side (the client discards its tokens).
- Login returns the same generic `401` for a wrong password and an unknown email,
  so the API does not leak which emails are registered.

### Register

```bash
curl -s -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"sup3rsecret","name":"Ada Owner"}'
```

```json
{
  "success": true,
  "data": {
    "user": { "id": "6650...", "email": "owner@example.com", "name": "Ada Owner" },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  }
}
```

Errors: `409 EMAIL_TAKEN` (email already registered), `400 BAD_REQUEST` (invalid body).

### Login

```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"sup3rsecret"}'
```

Returns the same `{ user, accessToken, refreshToken }` shape. `401 INVALID_CREDENTIALS`
on a bad email or password.

### Current user

```bash
ACCESS="<accessToken>"
curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer $ACCESS"
```

```json
{ "success": true, "data": { "user": { "id": "6650...", "email": "owner@example.com", "organizationId": null, "role": null } } }
```

`401 UNAUTHORIZED` without a token; `401 TOKEN_EXPIRED` when the access token has expired.

### Refresh

```bash
curl -s -X POST http://localhost:4000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Returns a fresh `{ user, accessToken, refreshToken }`. `401` for an invalid,
expired, or non-refresh token.

### Logout

```bash
curl -s -X POST http://localhost:4000/api/auth/logout
```

`200 OK`; the client then discards its tokens.

---

## Phase 2 — Organizations / Multi-Tenancy

**What / why.** An organization is a tenant (a company using the helpdesk). Every
user belongs to at most one organization, and all org-owned data will be strictly
isolated per organization. This is the security backbone against cross-tenant
access (IDOR/BOLA).

**Business logic.**
- Registration stays identity-only; a logged-in user creates their organization
  and becomes its first member with role `ADMIN`.
- Organization context (`organizationId`, `role`) is carried inside the access
  token, so tenant scoping needs no per-request database lookup. Creating an org
  therefore **reissues tokens** — the client must switch to the returned tokens
  (or call `refresh`) for the new context to take effect.
- Cross-tenant lookups return `404`, never `403`, so the API never confirms that
  another tenant's resource exists.

### Create an organization

```bash
ACCESS="<accessToken from register/login>"
curl -s -X POST http://localhost:4000/api/organizations \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Acme Inc"}'
```

```json
{
  "success": true,
  "data": {
    "organization": { "id": "6651...", "name": "Acme Inc", "createdAt": "...", "updatedAt": "..." },
    "accessToken": "<new jwt with org context>",
    "refreshToken": "<new jwt>"
  }
}
```

Errors: `401 UNAUTHORIZED`, `409 ALREADY_IN_ORGANIZATION` (caller already has an
org), `400 BAD_REQUEST` (invalid name). Use the returned `accessToken` for the calls below.

### My organization

```bash
ORG_ACCESS="<accessToken returned by create-org>"
curl -s http://localhost:4000/api/organizations/me -H "Authorization: Bearer $ORG_ACCESS"
```

`403 ORG_REQUIRED` if the authenticated user has not created/joined an org yet.

### Look up by id (tenant-scoped)

```bash
curl -s http://localhost:4000/api/organizations/<orgId> -H "Authorization: Bearer $ORG_ACCESS"
```

Returns the org only when `<orgId>` is the caller's own organization; any other id
returns `404 NOT_FOUND`. This is the ownership-check pattern every future
org-owned resource (`/tickets/:id`, `/customers/:id`, ...) will follow.

### Rename the organization

```bash
curl -s -X PATCH http://localhost:4000/api/organizations/me \
  -H "Authorization: Bearer $ORG_ACCESS" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Acme Support"}'
```

`200 OK` with the updated organization. (Role-based restriction on who may edit is
added in Phase 3.)

---

## Phase 3 — Users, Roles & Teams

**What / why.** Turn an organization into a real team: manage its members,
enforce roles on the backend, and group agents into teams for future ticket
routing.

**Business logic.**
- Roles are enforced server-side (not just hidden in the UI). Matrix:
  managing **users** (create, change role, activate/deactivate) is `ADMIN`;
  managing **teams** (create/rename/delete + membership) is `ADMIN` or
  `MANAGER`; listing users/teams is available to any role. `AGENT` is read-only.
- Members are created directly by an admin (email, name, password, role) and
  then log in via `/auth/login`.
- You cannot modify your own role or status, which guarantees the org always
  keeps at least one active admin (no lockout).
- Deactivating a user blocks new logins and refreshes (`403 ACCOUNT_DISABLED`);
  an already-issued access token still works until it expires (~15m).
- All queries are scoped by the caller's `organizationId`; a resource in another
  tenant returns `404`. Team members must belong to the same organization.

All endpoints below require `Authorization: Bearer <access token with org context>`.

### Create a member (ADMIN)

```bash
ADMIN="<org-scoped admin access token>"
curl -s -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"agent@example.com","name":"Amy Agent","password":"sup3rsecret","role":"AGENT"}'
```

`201` with the new user. Errors: `403 FORBIDDEN` (caller not ADMIN),
`409 EMAIL_TAKEN`, `400 BAD_REQUEST`.

### List / get members (any role)

```bash
curl -s http://localhost:4000/api/users -H "Authorization: Bearer $ADMIN"
curl -s http://localhost:4000/api/users/<userId> -H "Authorization: Bearer $ADMIN"
```

`GET /:id` returns `404` for a user outside your organization.

### Change role or activate/deactivate (ADMIN)

```bash
curl -s -X PATCH http://localhost:4000/api/users/<userId> \
  -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"MANAGER"}'

curl -s -X PATCH http://localhost:4000/api/users/<userId> \
  -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"isActive":false}'
```

`400 CANNOT_MODIFY_SELF` if `<userId>` is your own id; `404` for another tenant's user.

### Teams (ADMIN or MANAGER to manage; any role to read)

```bash
# Create
curl -s -X POST http://localhost:4000/api/teams \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"name":"Billing"}'

# List / get
curl -s http://localhost:4000/api/teams -H "Authorization: Bearer $ADMIN"
curl -s http://localhost:4000/api/teams/<teamId> -H "Authorization: Bearer $ADMIN"

# Rename / delete
curl -s -X PATCH http://localhost:4000/api/teams/<teamId> \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"name":"Billing EU"}'
curl -s -X DELETE http://localhost:4000/api/teams/<teamId> -H "Authorization: Bearer $ADMIN"

# Membership
curl -s -X POST http://localhost:4000/api/teams/<teamId>/members \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"userId":"<userId>"}'
curl -s -X DELETE http://localhost:4000/api/teams/<teamId>/members/<userId> \
  -H "Authorization: Bearer $ADMIN"
```

`409 TEAM_NAME_TAKEN` for a duplicate name within the org; `404` for a team or
member outside your organization; `403 FORBIDDEN` for an AGENT attempting to manage.
