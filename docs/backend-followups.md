# Backend follow-ups

API gaps surfaced while rebuilding the four dashboard surfaces on the new UI
system (Phases 2–4, branch `feature/new-ui-dashboards`). None of these were
fixable from the frontend without changing contracts, so they are queued here.
The backend remains the authority for all authorization; the client-side guards
in `next-frontend/src/components/dashboard/RoleGuard.tsx` are UX-only.

## Endpoints / features missing

### 1. Platform-wide stats endpoint
The Super Admin overview and the College Admin overview compute their tallies
(colleges, admins, users, clubs, events, registrations) client-side by fetching
full lists and reducing them in the browser — a single server-side aggregate
endpoint would keep the numbers consistent, avoid shipping entire tables to
count rows, and let the cards load in one request.

### 2. Student club-membership endpoint
Students have no API to list the clubs they belong to (`GET /manager/my-clubs`
is manager-only), so the student area shipped without a "My clubs" screen; an
authenticated `GET /clubs/my` scoped to the current tenant would enable it.

### 3. Event Manager count includes pending inactive accounts
The admin manager list/count endpoints do not filter on `isActive`, so invited
but not-yet-activated accounts inflate "managers" numbers; the College Admin
overview separates them in the UI for now, but a server-side filter (or an
`active`/`pending` split in the payload) would fix it at the source.

### 4. Event registration fields are not authorable via the API
`createEventBody`/`updateEventBody` validators
(`backend/validators/schemas.js`) accept only `registrationUrl` —
`registrationMode` (INTERNAL/EXTERNAL/NONE), `customFormDefinition` (custom
form fields) and `registrationDeadline` cannot be set through the API, so the
custom-form and external-registration flows the public event page already
renders are unreachable in practice (every event is effectively INTERNAL,
form-less, no deadline).

### 5. No guest (unauthenticated) event registration
`POST /events/:eventId/register` is `authenticateToken`-gated and
`event_registrations.user_id` is NOT NULL (`backend/prisma/schema.prisma`), so
outsiders without a tenant account cannot register at all; a form-style guest
flow needs a public endpoint plus a schema migration (nullable/guest identity
or auto-provisioned users) and guest dedupe (email + event).

### 6. No rate limiter on event registration
`backend/middleware/rateLimiters.js` ships auth/login/invite/upload/destructive
limiters only; the registration and cancellation endpoints have none, which
matters once guest registration (item 5) or public traffic scales.

### 7. Admin departments read path uses the public endpoints
The College Admin departments screen lists departments via the unauthenticated
public routes (`GET /departments`, `GET /departments/:id` in
`backend/routes/publicRoutes.js`) — writes are properly admin-gated, but the
read path bypasses role checks (tenant-scoped public data, so not a leak; a
dedicated admin read endpoint would keep the surface consistent).

### 8. `/auth/me` does not include the college slug
The session endpoint returns `collegeId` (UUID) only, so the frontend cannot
build the user's own-college links from the session alone; the client currently
binds `collegeId ↔ slug` at login time (`next-frontend/src/lib/auth/collegeBinding.ts`).
Returning `college { slug, name }` in `/auth/me` (and login responses) would
remove that workaround.
