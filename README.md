# Al Raziq POS — Web App

Restaurant, retail and room-reservation point of sale. A standard React SPA with
serverless API routes: runs locally with one command and deploys to Vercel with
no configuration.

## Run locally

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — sign in with PIN `1234` (Owner).

That single command serves the UI *and* the `/api` handlers, so local behaviour
matches production exactly.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload + API on one port |
| `npm run build` | Static production build into `dist/` |
| `npm run preview` | Serve the built `dist/` (UI only, no API) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

Demo PINs — Owner `1234` · Cashier `1111` · Waiter `2222` · Kitchen `3333`.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Accept the detected settings (Framework **Vite**, build `npm run build`,
   output `dist`) and click **Deploy**.

Nothing else is required — `vercel.json` already configures the SPA rewrite and
cache headers, and every file in `api/` is deployed as a serverless function.

Or from the CLI:

```bash
npx vercel        # preview deployment
npx vercel --prod # production
```

## Data & sync

Each browser keeps a full working copy of the POS in local storage, so the app
stays usable with no network at all. On top of that, `/api/state` holds one
shared snapshot that all devices push to and pull from — open the same URL on a
phone, tablet or second till and they share the same menu, orders and settings.

Storage is chosen automatically (shown in **Settings → Cloud Sync**):

| Driver | When it is used | Persistence |
|---|---|---|
| `file` | local `npm run dev` — writes `.pos-data/state.json` | permanent on your machine |
| `redis` | any deploy with KV env vars set | permanent, shared across regions |
| `memory` | a deploy with no storage configured | temporary — resets on cold start |

**For a real deployment, add a KV store** so shared data survives restarts: in the
Vercel dashboard open **Storage → Create Database → Redis** (Upstash) and connect
it to the project. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which is
all the app looks for. Without it the POS still works — each browser simply keeps
its own copy.

Compatible variable names: `KV_REST_API_URL` / `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

> **Note:** `/api/state` is unauthenticated, exactly as the previous LAN server
> was. That was safe on a shop's private Wi-Fi; on a public URL anyone with the
> link can read the shared snapshot (which includes staff PINs). Put the
> deployment behind Vercel password protection, or ask for an auth layer to be
> added, before using it publicly.

## Modules

POS · Room Reservations · Kitchen Display · Tables · Orders · Sales Returns ·
Menu · Inventory · Customers & Loyalty · Promotions · Shifts & Cash Drawer ·
Expenses · Staff & Access · Reports (13 tabs) · Settings · FBR integration

Receipts and kitchen tickets print through the browser's print dialog (58 mm /
80 mm thermal layouts), and the app installs as a PWA for a full-screen
till-like experience.

## Structure

```
api/            Serverless functions (health, shared state, storage drivers)
public/         Static assets and icons
src/
  components/   App shell + shadcn/ui primitives
  lib/          Store (Zustand), sync, receipts, FBR, exports
  routes/       File-based routes — one file per module
index.html      SPA entry
vercel.json     SPA rewrite + cache headers
```

## Tech

React 19 · TanStack Router · Vite 7 · Tailwind CSS 4 · Zustand · Recharts ·
Radix UI · vite-plugin-pwa
