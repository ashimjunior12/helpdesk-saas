# Security Review

A summary of the security posture of the Helpdesk SaaS backend, by area. This is
a living document updated as the app evolves.

## Authentication
- Passwords hashed with bcrypt (cost 12); never stored or logged in plaintext.
- Stateless JWTs: short-lived access token (~15m) + refresh token (~7d), signed
  with separate secrets and carrying a `type` claim so an access token cannot be
  replayed at the refresh endpoint.
- Login returns the same generic `401` for a wrong password and an unknown email
  (no user enumeration) and runs a constant-time comparison even when the user
  does not exist.
- Deactivated (`isActive: false`) users are rejected at login and refresh.
- JWT secrets are required at startup (min length enforced) and validated by Zod.

## Authorization & multi-tenancy
- Org context (`organizationId`, `role`) is derived from the authenticated token,
  never trusted from the client.
- `requireAuth` -> `requireOrg` -> `requireRole` guard the routes; roles are
  enforced on the backend (never by hiding UI).
- Every organization-owned query is scoped by `organizationId`. Cross-tenant
  access to a resource - or to a *linked* id (ticket customer/assignee/team,
  attachment, message, note) - returns `404`, never confirming existence.
- Internal notes live in a separate collection and are never returned by the
  public messages endpoint (structural, not filter-based, isolation).

## Input validation
- All request bodies are validated at the boundary with Zod; query params are
  parsed with Zod in the controllers.
- Mongoose `CastError` (e.g. malformed id) maps to `404`, not `500`.
- Queries never interpolate raw client objects as operators, avoiding NoSQL
  operator injection; search terms are regex-escaped.

## Rate limiting (Phase 19)
- IP-based limits on auth (`20/min`), the public API (`100/min`), and the public
  widget (`20/min`), returning the standard `429 RATE_LIMITED` envelope.
- In-memory store (single instance); use a Redis store for multi-instance.
- Skipped in the test environment for deterministic tests.

## Secrets & API keys
- Secret API keys are stored only as a SHA-256 hash (+ display prefix); the raw
  key is shown once and never persisted or serialized. Keys are revocable.
- The embeddable widget uses a separate, non-secret public key that can only read
  display config and submit a ticket - never read data.

## File uploads
- MIME allowlist + size cap; files stored under generated names (no path
  traversal); the on-disk name is never exposed.
- Downloads are always served as `Content-Disposition: attachment` (never inline),
  preventing stored XSS via HTML/SVG.

## Transport & headers
- `helmet` sets secure headers and removes `X-Powered-By`.
- Restrictive CORS allowlist for the authenticated API; the public widget gets its
  own permissive CORS (it is embedded on arbitrary sites) limited to
  read-config/submit-ticket.
- JSON body size limits (`1mb` API, `100kb` widget).

## Logging
- Structured logs (Pino) redact `authorization`/`cookie` headers and any
  `password`/`token`/`accessToken`/`refreshToken` fields. Errors never leak stack
  traces to clients in production.

## Known gaps / future work
- Refresh tokens are stateless (no server-side revocation); logout is client-side.
  A hashed refresh-token store would allow revocation.
- Rate-limit store is in-memory; move to Redis for horizontal scaling.
- No email verification / password reset yet (needs email infra).
- Access-token TTL (~15m) is the propagation delay for role/org/deactivation
  changes.
