# Walkthrough - Features, Business Logic & API

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

## Phase 0 - Foundation

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

## Phase 1 - Authentication

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

## Phase 2 - Organizations / Multi-Tenancy

**What / why.** An organization is a tenant (a company using the helpdesk). Every
user belongs to at most one organization, and all org-owned data will be strictly
isolated per organization. This is the security backbone against cross-tenant
access (IDOR/BOLA).

**Business logic.**
- Registration stays identity-only; a logged-in user creates their organization
  and becomes its first member with role `ADMIN`.
- Organization context (`organizationId`, `role`) is carried inside the access
  token, so tenant scoping needs no per-request database lookup. Creating an org
  therefore **reissues tokens** - the client must switch to the returned tokens
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

## Phase 3 - Users, Roles & Teams

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

---

## Phase 4 - Customers

**What / why.** Customers are the end-users who need support (distinct from
`Users`, who are the org's staff). Each organization manages its own customer
records; tickets (Phase 5) will be raised on behalf of a customer.

**Business logic.**
- A customer's email is required and unique within the organization (two
  different tenants may reuse the same email).
- Reading and searching customers is available to any org member. Creating and
  updating is allowed for any role (agents work with customers daily); deleting
  is restricted to `ADMIN` or `MANAGER`.
- Listing supports `?search=` (matches name or email, case-insensitive) with
  offset pagination (`?page=&limit=`, limit 1..100, default 20).
- Every query is scoped by the caller's `organizationId`; a customer in another
  tenant returns `404`.

All endpoints require `Authorization: Bearer <access token with org context>`.

### Create (any role)

```bash
ADMIN="<org-scoped access token>"
curl -s -X POST http://localhost:4000/api/customers \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"name":"Jane Buyer","email":"jane@buyer.com","phone":"+1 555 0100","notes":"VIP"}'
```

`201` with the customer. `409 CUSTOMER_EMAIL_TAKEN` for a duplicate email in the
org; `400 BAD_REQUEST` for invalid input.

### List / search / paginate (any role)

```bash
curl -s "http://localhost:4000/api/customers?search=jane&page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN"
```

```json
{
  "success": true,
  "data": {
    "customers": [ { "id": "...", "name": "Jane Buyer", "email": "jane@buyer.com" } ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```

### Get / update (any role)

```bash
curl -s http://localhost:4000/api/customers/<customerId> -H "Authorization: Bearer $ADMIN"

curl -s -X PATCH http://localhost:4000/api/customers/<customerId> \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"notes":"Renewed plan"}'
```

`404` for a customer outside the caller's organization.

### Delete (ADMIN or MANAGER)

```bash
curl -s -X DELETE http://localhost:4000/api/customers/<customerId> -H "Authorization: Bearer $ADMIN"
```

`204` on success; `403 FORBIDDEN` for an AGENT; `404` for another tenant's customer.

---

## Phase 5 - Tickets

**What / why.** A ticket is a support request: it links a customer to a status,
priority, and (optionally) an assigned agent and team, so the org can track and
route support work. This is the core entity of the product.

**Business logic.**
- New tickets start `OPEN` and get a per-organization sequential `number`
  (#1, #2, ...) via an atomic counter, alongside their internal id.
- Status follows a state machine; invalid transitions are rejected
  (`409 INVALID_STATUS_TRANSITION`):
  `OPEN -> PENDING|RESOLVED|CLOSED`, `PENDING -> OPEN|RESOLVED|CLOSED`,
  `RESOLVED -> OPEN|CLOSED`, `CLOSED -> OPEN` (reopen).
- Priority is one of `LOW|MEDIUM|HIGH|URGENT` (default `MEDIUM`).
- Linked ids are tenant-checked: the `customerId`, `assignedAgentId` (must be an
  active member), and `teamId` must all belong to the caller's organization,
  otherwise `404`.
- Read/list is open to any role; create/update/status/assign to any role;
  delete to `ADMIN` or `MANAGER`.
- The threaded conversation on a ticket comes in Phase 6; here a ticket carries
  only an optional initial `description`.

All endpoints require `Authorization: Bearer <access token with org context>`.

### Create (any role)

```bash
ADMIN="<org-scoped access token>"
curl -s -X POST http://localhost:4000/api/tickets \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"subject":"Cannot log in","description":"500 on login","priority":"HIGH","customerId":"<customerId>"}'
```

`201` with the ticket (`number`, `status:"OPEN"`, ...). `404` if the customer /
assignee / team is outside the org; `400` for invalid input.

### List / filter / search / paginate (any role)

```bash
curl -s "http://localhost:4000/api/tickets?status=OPEN&priority=HIGH&assignedAgentId=<id>&search=login&page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN"
```

Returns `{ tickets: [...], pagination: { page, limit, total, totalPages } }`.
Filters: `status`, `priority`, `assignedAgentId`, `customerId`, `teamId`;
`search` matches the subject.

### Get / update content (any role)

```bash
curl -s http://localhost:4000/api/tickets/<ticketId> -H "Authorization: Bearer $ADMIN"

curl -s -X PATCH http://localhost:4000/api/tickets/<ticketId> \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"priority":"URGENT","category":"auth"}'
```

`PATCH` updates content fields only (`subject`, `description`, `priority`,
`category`) - status and assignment have dedicated endpoints below.

### Change status (any role, transition-validated)

```bash
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/status \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"status":"RESOLVED"}'
```

`409 INVALID_STATUS_TRANSITION` if the move is not allowed from the current status.

### Assign / unassign (any role)

```bash
# Assign an agent and/or team
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/assign \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"assignedAgentId":"<userId>","teamId":"<teamId>"}'

# Clear an assignment with null
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/assign \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"assignedAgentId":null}'
```

`404` if the agent/team is outside the org.

### Delete (ADMIN or MANAGER)

```bash
curl -s -X DELETE http://localhost:4000/api/tickets/<ticketId> -H "Authorization: Bearer $ADMIN"
```

`204` on success; `403 FORBIDDEN` for an AGENT; `404` for another tenant's ticket.

---

## Phase 6 - Conversations & Messages

**What / why.** The back-and-forth on a ticket. Messages are attached directly
to the ticket (the ticket is the conversation), turning a static record into a
support thread.

**Business logic.**
- A message is reached through its ticket; the ticket is looked up tenant-scoped,
  so a ticket in another organization is unreachable (`404`).
- The authenticated staff member posts a message and sets `authorType`:
  `AGENT` attributes it to the acting user; `CUSTOMER` attributes it to the
  ticket's customer (for logging inbound emails/calls until the widget exists).
- Messages are append-only (no edit). Listing is chronological (oldest first)
  with pagination. Posting a message does not auto-change ticket status.
- Create/list: any role. Delete (moderation): `ADMIN` or `MANAGER`.

All endpoints require `Authorization: Bearer <access token with org context>`.

### Post a message (any role)

```bash
ADMIN="<org-scoped access token>"
# Agent reply
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/messages \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"body":"Looking into this now.","authorType":"AGENT"}'

# Log an inbound customer message
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/messages \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"body":"It still fails on mobile.","authorType":"CUSTOMER"}'
```

`201` with the message (`authorType`, `authorId`, `body`, `createdAt`). `404` if
the ticket is outside the caller's org; `400` for an empty body or bad authorType.

### List the conversation (any role)

```bash
curl -s "http://localhost:4000/api/tickets/<ticketId>/messages?page=1&limit=50" \
  -H "Authorization: Bearer $ADMIN"
```

Returns `{ messages: [...oldest first...], pagination: { page, limit, total, totalPages } }`.

### Delete a message (ADMIN or MANAGER)

```bash
curl -s -X DELETE http://localhost:4000/api/tickets/<ticketId>/messages/<messageId> \
  -H "Authorization: Bearer $ADMIN"
```

`204` on success; `403 FORBIDDEN` for an AGENT; `404` for another tenant's ticket/message.

---

## Phase 7 - Real-Time Messaging (Socket.IO)

**What / why.** Push live updates to connected agents (new messages, ticket
changes) instead of polling. A Socket.IO server runs on the same HTTP server as
the REST API.

**Business logic.**
- **Auth:** the client sends the access token in the handshake (`auth: { token }`);
  it is verified with the same logic as the REST API. No/invalid token -> the
  connection is refused (`connect_error` "Unauthorized").
- **Rooms & scoping:** on connect the socket joins its org room automatically.
  To receive a ticket's events the client sends `ticket:subscribe { ticketId }`;
  the server joins the ticket room only after confirming the ticket is in the
  caller's org, so a foreign/guessed ticket id can never be joined.
- **Events are emitted from the normal REST flows** - creating a message or
  changing a ticket over HTTP broadcasts to the relevant rooms. There is no
  separate write path over the socket.

Server -> client events:

| Event | Room | Fired when |
| ----- | ---- | ---------- |
| `message:created` | ticket | a message is posted |
| `message:deleted` | ticket | a message is deleted |
| `ticket:created` | org | a ticket is created |
| `ticket:updated` | org + ticket | a ticket's content is edited |
| `ticket:status_changed` | org + ticket | status transition |
| `ticket:assigned` | org + ticket | agent/team assignment changes |
| `ticket:deleted` | org | a ticket is deleted |

Client -> server events (with ack): `ticket:subscribe { ticketId }`,
`ticket:unsubscribe { ticketId }` -> `{ ok: true } | { ok: false, error }`.

### Client example (socket.io-client)

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  transports: ['websocket'],
  auth: { token: accessToken }, // the JWT access token
});

socket.on('connect_error', (err) => console.error('socket auth failed:', err.message));

// Subscribe to a ticket's live stream
const ack = await socket.emitWithAck('ticket:subscribe', { ticketId });
// ack === { ok: true }  (or { ok: false, error: 'NOT_FOUND' | 'INVALID' })

socket.on('message:created', (message) => appendToThread(message));
socket.on('ticket:status_changed', (ticket) => updateTicket(ticket));

// Later
socket.emit('ticket:unsubscribe', { ticketId });
```

A new message still gets posted over REST (`POST /api/tickets/:id/messages`);
subscribed clients receive it as a `message:created` event in real time.

---

## Phase 8 - Internal Notes

**What / why.** Private, staff-only notes on a ticket (context, escalation
reasoning) that the customer must never see.

**Business logic.**
- Notes live in their own collection with their own endpoints. The public
  messages endpoint never queries notes, so a note cannot leak to a
  customer-facing channel by construction.
- A note is always authored by the acting staff user. Any staff role can create
  and list notes; delete is `ADMIN` or `MANAGER`. Append-only.
- Reached through a tenant-scoped ticket lookup (another org's ticket -> 404).
- Real-time: `note:created` / `note:deleted` are emitted to the ticket room,
  which today only authenticated staff can join.

All endpoints require `Authorization: Bearer <access token with org context>`.

### Add a note (any staff role)

```bash
ADMIN="<org-scoped access token>"
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/notes \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"body":"Called billing; refund approved, awaiting confirmation."}'
```

`201` with the note (`authorId`, `body`, `createdAt`). `404` if the ticket is
outside the caller's org; `400` for an empty body.

### List notes (any staff role)

```bash
curl -s "http://localhost:4000/api/tickets/<ticketId>/notes?page=1&limit=50" \
  -H "Authorization: Bearer $ADMIN"
```

Returns `{ notes: [...oldest first...], pagination: { ... } }`.

### Delete a note (ADMIN or MANAGER)

```bash
curl -s -X DELETE http://localhost:4000/api/tickets/<ticketId>/notes/<noteId> \
  -H "Authorization: Bearer $ADMIN"
```

`204`; `403 FORBIDDEN` for an AGENT; `404` for another tenant's ticket/note.

Notes and messages are separate: `GET /api/tickets/:id/messages` returns only
public messages and never internal notes.

---

## Phase 9 - Notifications

**What / why.** Tell an agent when something needs them: a ticket assigned to
them, a new message, or a status change. Stored per user (for a badge / unread
count) and pushed live over the socket layer.

**Business logic.**
- Recipients are the ticket's **assigned agent**; the person who performed the
  action is never notified of their own action.
- Triggers: `TICKET_ASSIGNED` (on assignment or assigned-at-creation),
  `TICKET_MESSAGE` (new message), `TICKET_STATUS` (status change).
- Notifications are per user, scoped to `{ userId, organizationId }` - you only
  ever see and manage your own.
- Generation is best-effort: a notification failure never fails the underlying
  ticket/message operation.
- Live delivery: `notification:created` is emitted to the recipient's private
  `user:<id>` socket room (joined automatically on connect).

All endpoints require `Authorization: Bearer <access token with org context>`.

### List your notifications

```bash
TOKEN="<org-scoped access token>"
curl -s "http://localhost:4000/api/notifications?unread=true&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `{ notifications: [...newest first...], pagination: { ... } }`. Each
notification has `type`, `title`, `body`, `ticketId`, `ticketNumber`, `isRead`.

### Unread count (for a badge)

```bash
curl -s http://localhost:4000/api/notifications/unread-count -H "Authorization: Bearer $TOKEN"
# { "success": true, "data": { "count": 3 } }
```

### Mark one / all read

```bash
curl -s -X POST http://localhost:4000/api/notifications/<id>/read -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:4000/api/notifications/read-all  -H "Authorization: Bearer $TOKEN"
# read-all -> { "data": { "updated": <count> } }
```

`404` when marking a notification that is not yours.

### Live delivery (socket)

```js
socket.on('notification:created', (n) => { badge.increment(); toast(n.title); });
```

---

## Phase 10 - Redis + BullMQ

**What / why.** Move fan-out work (starting with notifications) off the request
path into a background worker, so slow or bursty side-effects don't block the
API response. Redis backs the BullMQ queues.

**Business logic.**
- **Optional by design.** If `REDIS_URL` is not set, queues are disabled and the
  work runs **inline** - the app runs fully without Redis (dev and tests do this).
- When `REDIS_URL` is set, notification generation is enqueued to the
  `notifications` queue and processed by a worker (attempts: 3, exponential
  backoff). The API responds without waiting for the notification write.
- **Graceful degradation:** if Redis is configured but unreachable at enqueue
  time, the code falls back to running the job inline, so a notification is never
  silently lost.
- The unit of work is unchanged (persist notification + emit `notification:created`);
  only *where* it runs moves. Ticket/message flows are untouched by the switch.

**Running with Redis (optional):**

```bash
# Start Redis (e.g. Docker)
docker run -p 6379:6379 redis:7

# Point the backend at it
echo 'REDIS_URL=redis://127.0.0.1:6379' >> backend/.env
npm run dev   # logs "Workers started" instead of "Queues disabled"
```

There are no new HTTP endpoints in this phase - the API surface is identical;
notifications simply flow through the queue when Redis is present. This queue +
worker pattern (retries, backoff, inline fallback) is what later async work
(SLA checks, email) will reuse.

---

## Phase 11 - SLA System

**What / why.** Hold support to time targets: how fast a ticket should get a
first response and be resolved, by priority. Breaches are flagged and the
assignee is notified.

**Business logic.**
- Each org has one SLA policy: per-priority `firstResponseMins` and
  `resolutionMins` (sensible defaults until customized; `ADMIN` edits it).
- On creation a ticket gets `firstResponseDueAt` / `resolutionDueAt` from the
  policy and its priority. The first AGENT message sets `firstRespondedAt`;
  resolving/closing sets `resolvedAt` (reopening clears it).
- A repeatable BullMQ job (every minute, when Redis is configured) evaluates
  breaches: an unmet, still-open ticket past its due time is flagged
  (`firstResponseBreached` / `resolutionBreached`) once and its assignee gets an
  `SLA_BREACH` notification. The evaluation is idempotent.

### SLA policy (GET any role, PUT ADMIN)

```bash
ADMIN="<org-scoped admin token>"
curl -s http://localhost:4000/api/sla-policy -H "Authorization: Bearer $ADMIN"

curl -s -X PUT http://localhost:4000/api/sla-policy \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"targets":{
        "URGENT":{"firstResponseMins":5,"resolutionMins":60},
        "HIGH":{"firstResponseMins":30,"resolutionMins":240},
        "MEDIUM":{"firstResponseMins":120,"resolutionMins":720},
        "LOW":{"firstResponseMins":240,"resolutionMins":1440}}}'
```

Tickets now carry SLA fields (`firstResponseDueAt`, `resolutionDueAt`,
`firstRespondedAt`, `resolvedAt`, `firstResponseBreached`, `resolutionBreached`)
in their JSON, so a dashboard can show due/at-risk/breached state.

---

## Phase 12 - File Attachments

**What / why.** Attach files (screenshots, logs, documents) to a ticket.

**Business logic.**
- Files are stored on disk under `UPLOAD_DIR` with a generated name; the DB keeps
  metadata (original filename, mime type, size, uploader). The on-disk name is
  never exposed.
- Uploads are validated: a MIME allowlist (images, pdf, text/csv, zip, office
  docs) and a size cap (`MAX_UPLOAD_MB`, default 10). Rejections return `400`.
- Downloads are always served as `Content-Disposition: attachment` (never inline),
  avoiding stored-XSS via HTML/SVG.
- Everything is tenant-scoped through the ticket (another org -> 404). Upload/list
  = any staff role; delete = `ADMIN`/`MANAGER` (also removes the file from disk).

```bash
ADMIN="<org-scoped token>"
# Upload (multipart field name: file)
curl -s -X POST http://localhost:4000/api/tickets/<ticketId>/attachments \
  -H "Authorization: Bearer $ADMIN" -F 'file=@./screenshot.png'

# List
curl -s http://localhost:4000/api/tickets/<ticketId>/attachments -H "Authorization: Bearer $ADMIN"

# Download (streams the file)
curl -s -OJ http://localhost:4000/api/tickets/<ticketId>/attachments/<id>/download \
  -H "Authorization: Bearer $ADMIN"

# Delete (ADMIN/MANAGER)
curl -s -X DELETE http://localhost:4000/api/tickets/<ticketId>/attachments/<id> \
  -H "Authorization: Bearer $ADMIN"
```

---

## Phase 13 - Search

**What / why.** A single quick-search across the org: find a ticket or customer
fast from one box.

**Business logic.**
- `GET /api/search?q=` matches tickets by subject/category (and by ticket number
  when `q` is numeric) and customers by name/email, case-insensitively.
- Results are org-scoped and capped (`limit`, default 5, max 20). Input is
  regex-escaped, so a search term can never inject regex operators.

```bash
TOKEN="<org-scoped token>"
curl -s "http://localhost:4000/api/search?q=login&limit=5" -H "Authorization: Bearer $TOKEN"
# { "data": { "query": "login", "tickets": [...], "customers": [...] } }
```

Substring matching is used (better for quick-search than whole-token `$text`);
switching to a Mongo text index or a dedicated search engine is a future option.

---

## Phase 14 - Analytics

**What / why.** A dashboard summary of an org's support load and performance.

**Business logic.**
- `GET /api/analytics/overview?days=30` returns, for the caller's org: totals
  (all tickets, currently open), counts by status and by priority, SLA breach
  counts, average first-response and resolution times (ms), and a created-per-day
  series over the last `days`.
- Computed in a single MongoDB `$facet` aggregation, org-scoped. Any role reads.

```bash
TOKEN="<org-scoped token>"
curl -s "http://localhost:4000/api/analytics/overview?days=30" -H "Authorization: Bearer $TOKEN"
```

```json
{
  "data": {
    "totals": { "tickets": 2, "open": 1 },
    "byStatus": { "OPEN": 1, "PENDING": 0, "RESOLVED": 1, "CLOSED": 0 },
    "byPriority": { "LOW": 1, "MEDIUM": 0, "HIGH": 1, "URGENT": 0 },
    "sla": { "firstResponseBreached": 0, "resolutionBreached": 0 },
    "avgFirstResponseMs": null,
    "avgResolutionMs": 1234,
    "createdSeries": [ { "date": "2026-09-10", "count": 2 } ]
  }
}
```

---

## Phase 15 - Automation

**What / why.** Let an org codify routing/triage rules so common tickets are
handled automatically on creation (e.g. "subject contains refund -> URGENT,
category billing, assign Billing team").

**Business logic.**
- A rule has a trigger (`TICKET_CREATED`), AND-conditions on `priority` /
  `category` / `subject` (operators `eq` / `contains` / `in`), and actions
  (`SET_PRIORITY`, `SET_CATEGORY`, `ASSIGN_TEAM`, `ASSIGN_AGENT`).
- On ticket creation the engine runs enabled rules in order; every matching
  rule's actions are applied. If priority changes, SLA due dates are recomputed.
  The engine is best-effort - a failure never fails ticket creation.
- Action targets (team/agent) are validated to the org when a rule is saved.
- Manage: `ADMIN`; read: any role.

```bash
ADMIN="<org-scoped admin token>"
curl -s -X POST http://localhost:4000/api/automation-rules \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"name":"Urgent refunds",
       "conditions":[{"field":"subject","operator":"contains","value":["refund"]}],
       "actions":[{"type":"SET_PRIORITY","value":"URGENT"},
                  {"type":"SET_CATEGORY","value":"billing"}]}'

curl -s http://localhost:4000/api/automation-rules -H "Authorization: Bearer $ADMIN"
```

Now creating a ticket whose subject contains "refund" comes out `URGENT` /
`billing` automatically.

---

## Phase 16 - Public API

**What / why.** Let external systems (a website backend, integrations) raise and
read tickets programmatically with an API key, without a user login.

**Business logic.**
- An `ADMIN` mints API keys through the normal authenticated API. The raw key
  (`hlpk_...`) is shown once; only a SHA-256 hash + a display prefix are stored.
  Keys can be listed and revoked.
- The public surface lives at `/api/public/v1`, authenticated by an `x-api-key`
  header. Everything is scoped to the key's org; a missing/invalid/revoked key
  returns `401`.
- Creating a ticket by API takes a customer `{ email, name }` and finds-or-creates
  that customer in the org, then creates the ticket (automation and SLA still
  apply). No acting user, so no self-notification.

```bash
ADMIN="<org-scoped admin token>"
# Mint a key (copy data.key now - it is not shown again)
curl -s -X POST http://localhost:4000/api/api-keys \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"name":"Website"}'

KEY="hlpk_..."
# Create a ticket via the public API
curl -s -X POST http://localhost:4000/api/public/v1/tickets \
  -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"customer":{"email":"buyer@example.com","name":"Buyer"},"subject":"Order issue","priority":"HIGH"}'

curl -s http://localhost:4000/api/public/v1/tickets -H "x-api-key: $KEY"
```

Rate limiting for this surface is added in the Phase 19 security pass.

---

## Phase 17 - Customer Support Widget

**What / why.** An embeddable support form customers use on the company's own
website to raise a ticket, without any login.

**Business logic.**
- Each org has a `WidgetConfig` with a **public** (non-secret) key that is safe to
  embed, plus display settings (title, welcome message, primary color, enabled).
  `ADMIN` reads/updates it and can rotate the key.
- Public, unauthenticated endpoints keyed by the public key (with their own
  permissive CORS so they work embedded on any origin): fetch display config and
  submit a ticket. Submission finds-or-creates the customer by email and creates
  the ticket (automation + SLA apply). The response is a minimal confirmation
  (ticket number only) - no internal fields leak to the anonymous caller.
- A disabled widget or unknown/rotated key returns `404`.

Admin config (JWT, ADMIN):

```bash
ADMIN="<org-scoped admin token>"
curl -s http://localhost:4000/api/widget-config -H "Authorization: Bearer $ADMIN"
curl -s -X PUT http://localhost:4000/api/widget-config -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"title":"Talk to us","primaryColor":"#111827"}'
curl -s -X POST http://localhost:4000/api/widget-config/rotate-key -H "Authorization: Bearer $ADMIN"
```

Public (embedded, `wgt_...` public key):

```bash
KEY="wgt_..."
curl -s http://localhost:4000/api/public/widget/$KEY/config
curl -s -X POST http://localhost:4000/api/public/widget/$KEY/tickets \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sam","email":"sam@buyer.com","subject":"Broken link","message":"The docs link 404s."}'
# { "data": { "ticketNumber": 12 } }
```

**Frontend.** A clean, accessible widget page at `/widget?key=<publicKey>`
(Next.js) fetches the display config, themes itself with the org's primary color,
and posts the form to the public endpoint - with real loading / error / success
states. It is designed to be dropped into an iframe on the customer's site.

---

## Phase 18 - Testing Improvements

**What / why.** Raise confidence that the modules work together, and enforce
quality automatically on every push.

- **End-to-end lifecycle test** (`tests/e2e/lifecycle.test.ts`): one journey -
  register -> org -> agent -> customer -> ticket (assigned) -> agent reply +
  internal note -> resolve -> notifications -> analytics -> search - asserting the
  cross-module outcomes (note stays private, assignee notified, analytics/search
  reflect the ticket).
- **Coverage script:** `npm run test:coverage` (and `test:ci` for CI).
- **CI** (`.github/workflows/ci.yml`): on push/PR to main, runs backend
  lint + typecheck + tests (in-memory Mongo, no services needed) and frontend
  typecheck + build.

---

## Phase 19 - Security Review

**What / why.** Close the abuse/brute-force gap and document the security posture.

- **Rate limiting** (`express-rate-limit`, IP-based): auth `20/min`, public API
  `100/min`, public widget `20/min`; over-limit returns the standard
  `429 RATE_LIMITED` envelope. In-memory store (single instance; use Redis for
  multi-instance). Skipped in the test environment so suites stay deterministic.
- **`docs/SECURITY.md`** documents auth, authorization/multi-tenancy, validation,
  rate limiting, secrets/API keys, file uploads, transport/headers, logging
  redaction, and known gaps.

Most controls (helmet, tenant isolation with 404-on-cross-tenant, boundary
validation, hashed secrets, forced-download, log redaction, no user enumeration)
were built into earlier phases; this phase adds throttling and the written review.

---

## Phase 20 - Observability

**What / why.** Make the running service measurable: metrics for scraping and a
liveness probe distinct from readiness.

- **`GET /metrics`** (Prometheus text) via `prom-client` on a dedicated registry:
  default process metrics plus `http_requests_total` and
  `http_request_duration_seconds`, labeled by method + status only (low
  cardinality).
- **`GET /api/health/live`** liveness (always 200 if the process is up), separate
  from `GET /api/health` readiness (checks MongoDB). Orchestrators use liveness to
  restart and readiness to route traffic.
- Structured request logs already carry `requestId` and duration (Phase 0).

```bash
curl -s http://localhost:4000/metrics | head
curl -s http://localhost:4000/api/health/live
```

---

## Phase 21 - Docker + Deployment

**What / why.** Package the whole stack so it runs anywhere with one command.

- **Backend `Dockerfile`** (multi-stage): compile TypeScript, then run only prod
  deps + `dist/` on `node:22-alpine` as the non-root `node` user, with an uploads
  volume. **Frontend `Dockerfile`**: Next.js `standalone` output for a small image.
- **`docker-compose.yml`** wires `mongo`, `redis`, `backend`, `frontend` with
  health checks; the backend waits for Mongo/Redis to be healthy. Uploads and
  Mongo data are named volumes. `.dockerignore` files keep images lean.
- Secrets/URLs come from a root `.env` (see `.env.docker.example`); the
  frontend's `NEXT_PUBLIC_API_BASE_URL` is a build arg (baked into the client).

```bash
cp .env.docker.example .env   # set JWT secrets
docker compose up --build
# frontend  -> http://localhost:3000  (widget at /widget?key=...)
# backend   -> http://localhost:4000  (health at /api/health)
```

With this stack the app runs with Redis present, so notifications flow through
BullMQ workers and the SLA breach job is scheduled automatically.

---

## Frontend UI

The Next.js frontend is a real agent dashboard plus the embeddable widget, built
on one cohesive design system (`src/app/globals.css`): a small neutral palette
with a single indigo accent, consistent spacing/radius/typography, subtle motion,
and a `prefers-color-scheme` dark variant. No gradient hero blobs, glassmorphism,
or emojis.

- **Auth** (`/login`): sign in or create an account. A first-time user is guided
  through creating their organization before entering the app. Access/refresh
  tokens are stored client-side and refreshed automatically on expiry.
- **App shell** (`/app`): a sidebar (Overview, Tickets, Customers), a top bar with
  a live notifications bell (unread count, updated over the socket), and the
  signed-in user with sign-out.
- **Overview** (`/app`): stat cards (open, total, SLA breaches, average
  resolution) from the analytics endpoint, plus recent tickets.
- **Tickets** (`/app/tickets`): status filters, search, and pagination; a "New
  ticket" dialog that finds-or-creates the customer by email. Clicking a ticket
  opens its detail.
- **Ticket detail** (`/app/tickets/:id`): the conversation thread with a reply
  composer, an internal-notes tab, and a details panel to change status,
  priority, and assignee. New messages, notes, and ticket changes arrive live
  over Socket.IO (the client subscribes to the ticket room).
- **Customers** (`/app/customers`): searchable, paginated list with an add-customer
  dialog.
- **Support widget** (`/widget?key=<publicKey>`): the customer-facing form,
  styled independently of the app theme (it is embedded in an iframe on
  third-party sites), with real loading, error, and success states.

Run the frontend with `npm run dev` in `frontend/` and open http://localhost:3000
(the root redirects to `/app`, which sends you to `/login` when signed out).

---

## Platform super admin

Above organizations sits a single platform **SUPER_ADMIN** who provisions
organizations and their admins/managers. Each org's admin/manager then runs their
own organization; the super admin does not belong to any organization.

**Business logic.**
- A super admin is seeded at startup if none exists, from `SUPER_ADMIN_EMAIL` /
  `SUPER_ADMIN_PASSWORD` (defaults `ashimjunior12@gmail.com` / `Random123` -
  change the password after first login). Seeding is idempotent and never
  overwrites an existing account.
- `SUPER_ADMIN` is a role value with no `organizationId`. The `/api/platform/*`
  endpoints are guarded by `requireSuperAdmin`; a normal org admin gets `403`.
- The super admin creates organizations and provisions members (ADMIN / MANAGER /
  AGENT) into any organization, reusing the same user-creation logic as an org
  admin. It cannot create another `SUPER_ADMIN` through the API.

Endpoints (super admin only):

```bash
SA="<super admin access token>"   # from POST /api/auth/login
# List organizations (with member counts)
curl -s http://localhost:4000/api/platform/organizations -H "Authorization: Bearer $SA"
# Create an organization
curl -s -X POST http://localhost:4000/api/platform/organizations \
  -H "Authorization: Bearer $SA" -H 'Content-Type: application/json' -d '{"name":"Acme Inc"}'
# List / provision members in an organization
curl -s http://localhost:4000/api/platform/organizations/<orgId>/users -H "Authorization: Bearer $SA"
curl -s -X POST http://localhost:4000/api/platform/organizations/<orgId>/users \
  -H "Authorization: Bearer $SA" -H 'Content-Type: application/json' \
  -d '{"email":"admin@acme.com","name":"Acme Admin","password":"sup3rsecret","role":"ADMIN"}'
```

**Frontend.** The super admin signs in at `/login` and is routed to a dedicated
platform area (`/app/platform`): an organizations grid with a create dialog, and
per-organization member management (add admins/managers/agents) - separate from
the org agent dashboard. Normal org users continue to self-serve or are
provisioned by the super admin, then use the org dashboard.
