# Lumidesk frontend (Next.js)

The owner-facing dashboard — **Calls** and **Bookings** — rebuilt as a proper
Next.js app (App Router, TypeScript, Tailwind). It talks to your existing
FastAPI backend as a plain API. The backend is unchanged; this just replaces the
old server-rendered HTML pages.

## Architecture (why it's built this way)

- **Next.js App Router + TypeScript.** Pages are React Server Components.
- **Secure, cookie-based auth.** You sign in on `/login`; a Next.js route handler
  (`/api/auth/login`) exchanges your credentials with FastAPI `POST /auth/login`,
  then stores the access token + org id in **httpOnly cookies**. The token never
  touches browser JavaScript.
- **Server-side data fetching.** The dashboard and bookings pages read
  `GET /calls` and `GET /bookings` **on the server** (with the token from the
  cookie) and render the result. The browser never calls FastAPI directly — so
  there are **no CORS issues** and no secrets in the client.
- **The design you approved**, ported faithfully: Onest, the colorful cards, the
  week calendar with the slide-over detail drawer, the gauge, stat sparklines —
  all rendered from real data, with clean empty states.

```
Browser ──(httpOnly cookie)──► Next.js (server) ──(Bearer token + X-Org-Id)──► FastAPI
```

## Run it

Prerequisites: Node 18.18+ and your FastAPI backend running (default
`http://localhost:8000`).

```bash
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

`BACKEND_URL` defaults to `http://localhost:8000`, so you don't need any env
file for local work. If your API runs elsewhere, create `frontend/.env.local`
with one line: `BACKEND_URL=http://your-host:port`.

Routes:

- `/` — the marketing site (public): hero, features, pricing, FAQ, contact.
- `/signup` — create an account (creates the auth user + your organization).
- `/login` — sign in.
- `/app` — the Calls dashboard (protected). `/app/bookings` — the calendar.

Open http://localhost:3000 for the marketing site. Create an account at
`/signup`, or `/login` with the Supabase account that owns your organization —
then you land on `/app`. Everything under `/app` is gated by a login cookie
(see `middleware.ts`).

To populate demo data for a walkthrough, run the seed script in the backend repo
(`python scripts/seed_demo.py`) — those calls and bookings show up here live.

### Production build

```bash
npm run build && npm start   # serves on :3000
```

Note: in production (`npm start`) the auth cookies are marked `Secure`, so serve
it over HTTPS. For local work use `npm run dev` (plain http is fine there).

## What's here

```
app/
  layout.tsx            root layout + Onest font + icon sprite
  globals.css           the ported design system (scoped per page)
  login/page.tsx        sign-in + first-run "name your business"
  page.tsx              Calls dashboard (server component → DashboardView)
  bookings/page.tsx     Bookings calendar (server component → BookingsView)
  api/auth/login        credential exchange → sets httpOnly cookies
  api/auth/logout       clears the session
  api/org               create an organization for a new user
components/
  Sidebar, Icon, IconSprite, DashboardView, BookingsView, NeedOrg
lib/
  api.ts                server-side backend fetch helpers (reads the cookie)
  types.ts              Call / Booking / Org shapes
middleware.ts           redirects to /login when there's no session
```

## Next steps (clean to add)

- **Actions** (mark a call resolved, mark a booking complete / cancel): the
  backend endpoints already exist (`PATCH /calls/{id}`, `PATCH /bookings/{id}`,
  `DELETE /bookings/{id}`). Add a route handler that proxies them with the cookie
  token, call it from the drawer, then `router.refresh()`. Same pattern as
  `/api/org`.
- **Live updates** for the "on a call now" banner via websockets/SSE.
- Retire the old `/ui/dashboard` and `/ui/bookings` HTML pages in the backend
  once you've moved over (they still work as a fallback).
