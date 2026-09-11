# User Guide

How to run and use the Helpdesk SaaS: the roles, the screens, and the day-to-day
workflows. For the full API reference with copy-paste `curl` examples, see
`docs/WALKTHROUGH.md`.

---

## 1. What this is

A multi-tenant customer support platform. Companies (organizations) manage their
support team, receive tickets from customers, reply in real time, keep private
internal notes, track SLA targets, automate triage, and view analytics. Customers
can raise tickets through an embeddable website widget or a public API.

## 2. Who uses it (roles)

| Role | Scope | Can do |
| --- | --- | --- |
| Super admin | The whole platform | Create organizations, add/remove their admins/managers/agents, and enter any organization to work inside it with full access. Belongs to no single org. |
| Admin | One organization | Everything inside their org: tickets, customers, members, teams, settings. |
| Manager | One organization | Manage tickets, customers, and teams; cannot manage members. |
| Agent | One organization | Handle tickets and customers (read/create/update); read-only on teams. |
| Customer | n/a | Not a login. A person who submits a request through the widget or public API; their requests become tickets. |

There are two sign-in pages:

- `/login` - team members (admin, manager, agent).
- `/super-admin` - the platform super admin (a separate, dark "Platform Console").

Each page rejects the wrong account type and links to the other.

---

## 3. Running the software

### Option A: Docker (recommended)

From the repository root:

```bash
cp .env.docker.example .env    # then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
docker compose up --build
```

- App (frontend): http://localhost:3001
- API (backend): http://localhost:4000
- MongoDB and Redis run inside the stack (not published to your host).

The backend seeds a super admin on first start.

### Option B: Local (without Docker)

You need MongoDB running locally. Redis is optional (background jobs run inline
without it).

```bash
# terminal 1: backend
cd backend
cp .env.example .env            # set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (>=32 chars)
npm install
npm run dev                     # http://localhost:4000

# terminal 2: frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

Local uses port 3000 for the frontend; Docker uses 3001. Use whichever your setup
prints.

### The seeded super admin

On startup the backend ensures a super admin exists (configurable via
`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`). The defaults are:

- Email: `bhattaraiashim789@gmail.com`
- Password: `Random123`

Change the password after first use (see the note at the end of this guide).

---

## 4. Super admin walkthrough

1. Open the app and go to **Platform sign-in** (`/super-admin`), or click
   "Platform administrator sign-in" from the team login page.
2. Sign in with the super admin email and password. You land on **Organizations**.
3. **Create an organization**: click "New organization", enter a name.
4. Open the organization and **Add member**: enter the person's name, email, a
   temporary password, and a role (Admin / Manager / Agent). Hand them those
   credentials; they sign in at `/login`.
5. **Work inside an organization**: on an organization's page click
   **Open dashboard**. You now see that org's full agent dashboard (tickets,
   customers, conversations, notes) with a banner showing which org you are in.
   Click **Exit to platform** to return to the organizations list.
6. **Remove a member**: on the organization's page click **Remove** next to any
   admin, manager, or agent. Their ticket assignments are cleared and they are
   removed from teams. You cannot remove yourself.

The super admin has full access to every organization's data. Anything an org
admin can do, the super admin can do inside any org.

---

## 5. Team member walkthrough (admin / manager / agent)

Sign in at `/login`.

- If you were provisioned by the super admin (or an org admin), you go straight
  to your organization's dashboard.
- If you register a brand-new account from the login page, you are asked to
  create your organization and you become its first Admin.

### Overview

The landing screen shows key numbers (open tickets, total, SLA breaches, average
resolution), a tickets-by-status bar, and your most recent tickets.

### Tickets

- **List**: filter by status (Open / Pending / Resolved / Closed), search by
  subject or ticket number, and page through results.
- **New ticket**: click "New ticket", enter a subject and priority, and the
  customer's name and email. If that customer email already exists it is reused;
  otherwise a customer record is created.
- **Ticket detail** (click a ticket):
  - **Conversation**: read the thread and send replies. Use "Log as customer
    message" to record something the customer said (for example a phone call or
    forwarded email).
  - **Internal notes**: a separate tab for private team notes. Customers never
    see these.
  - **Details panel**: change **Status** (an invalid transition is rejected),
    **Priority**, and **Assignee**.
  - New messages, notes, and ticket changes appear live (real time) while the
    ticket is open.

### Customers

Search and page through customer records, and add a customer (name, email,
optional phone). Deleting a customer is available to Admins and Managers.

### Notifications

The bell in the top bar shows unread notifications (a ticket assigned to you, a
new message, a status change, or an SLA breach on a ticket you own). Opening it
marks them read.

---

## 6. The customer support widget

Let customers raise tickets from your own website, with no login.

1. As an org admin, get your widget's public key and settings from the API
   (`GET /api/widget-config`) and adjust them (`PUT /api/widget-config`: title,
   welcome message, primary color). You can rotate the key
   (`POST /api/widget-config/rotate-key`).
2. The widget page lives at `/widget?key=<publicKey>`. Embed it on your site in an
   iframe, for example:

   ```html
   <iframe src="http://localhost:3001/widget?key=wgt_your_public_key"
           style="width:420px;height:600px;border:0"></iframe>
   ```

3. A customer fills in name, email, subject, and message. Submitting creates a
   ticket in your organization (it finds-or-creates the customer by email) and
   shows them the ticket number.

The public key is safe to embed: it can only submit a ticket and read the
widget's display settings, never read your data.

---

## 7. The public API (integrations)

For programmatic ticket creation from another system.

1. As an org admin, create an API key (`POST /api/api-keys`). The raw key
   (`hlpk_...`) is shown once; store it securely. List and revoke keys any time.
2. Call the public API with the `x-api-key` header:

   ```bash
   curl -X POST http://localhost:4000/api/public/v1/tickets \
     -H "x-api-key: hlpk_your_key" -H 'Content-Type: application/json' \
     -d '{"customer":{"email":"buyer@example.com","name":"Buyer"},
          "subject":"Order issue","priority":"HIGH"}'
   ```

3. You can also list and read tickets over the public API. See `WALKTHROUGH.md`.

---

## 8. Features that today live in the API

The dashboard covers auth, the overview, tickets (with conversation and notes),
customers, notifications, and the super-admin organization/member console.
These additional capabilities are fully implemented on the backend and are used
through the API (see `WALKTHROUGH.md` for exact requests):

- **Team members management for an org admin** (create, change role, activate or
  deactivate, delete): `/api/users`.
- **Teams** (group agents): `/api/teams`.
- **SLA policy** (per-priority first-response and resolution targets):
  `/api/sla-policy`. Tickets carry due dates and breach flags; a background job
  flags breaches and notifies the assignee.
- **Automation rules** (triage on ticket creation): `/api/automation-rules`.
- **Attachments** on a ticket: `/api/tickets/:id/attachments`.
- **Search** across tickets and customers: `/api/search?q=`.
- **Analytics** summary: `/api/analytics/overview`.

Every endpoint requires a signed-in session (an access token). The super admin
reaches org-scoped endpoints by selecting an org (the app does this automatically
when you "Open dashboard").

---

## 9. Real-time behavior

While a ticket is open in the dashboard, the client subscribes to that ticket and
receives new messages, notes, and status/assignment changes live. Notifications
also arrive live. If real time is unavailable (for example the connection drops),
the data still loads on open and refresh.

---

## 10. Tips and troubleshooting

- **Which port?** Docker serves the app on 3001, local dev on 3000. Sign-in and
  API calls must agree on origin; the Docker setup sets `CORS_ORIGIN` to match.
- **CORS errors** in the browser mean the backend's `CORS_ORIGIN` does not include
  the address you opened the app on. Set `CORS_ORIGIN` in your `.env` to that
  origin and recreate the backend (`docker compose up -d --force-recreate backend`).
- **Port already in use** on `docker compose up`: another process holds that host
  port. Stop it, or change the published port in `docker-compose.yml`.
- **Forgot which login to use?** Team members use `/login`; the platform super
  admin uses `/super-admin`. Each links to the other.
- **Change the super admin password.** The seeded password is a bootstrap default.
  Until an in-app "change password" screen exists, set a strong
  `SUPER_ADMIN_PASSWORD` before first boot on a fresh database, or update the
  stored password hash directly. Ask the maintainer if you want the in-app screen
  added.
- **Reset everything** (Docker, destroys all data): `docker compose down -v` then
  `docker compose up --build`.
