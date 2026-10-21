# Riverside Poker Dashboard

A portfolio demo of a dashboard I built for a real low-stakes home poker group. The club,
players and results here are **fictional**; a small fake API runs in the browser, so there is no
server, spreadsheet or database to set up. Sign in with any password and a guided tour walks
through the features.

## What it shows

- **Home:** season totals, "my night" recap, standings podium, club highlights and achievement badges
- **Games:** every cash game and tournament, with per-player results, knockouts and payouts
- **Live ledger:** track buy-ins and cash-outs as a night happens, with audit notes on edits and a balance check when closing
- **Players:** leaderboards by month or quarter, club points seasons, head-to-head comparison, career profiles
- **Club:** house rules and tournament blind schedule
- **Account:** profile pictures, dark/light theme, installable as an app

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Recharts, Radix UI. The original
product also has an Express 5 API, PostgreSQL (Drizzle ORM) and a Google Sheets integration;
those are left out of this demo.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:5000
pnpm test       # needs Node 22.6+
pnpm build      # static files in artifacts/poker-dashboard/dist/public
```

## Where things live

All under `artifacts/poker-dashboard/src`:

- `demo/data.ts`: the fictional players, sessions and tournaments (seeded, so stable)
- `demo/mock-api.ts`: answers `/api/*` inside the browser; live-ledger edits last until refresh
- `demo/tour.tsx`: the guided walkthrough
- `lib/brand.ts`: the club name

## Publishing on Replit

Import the repo into Replit and press **Publish**. `.replit` is set up as a static deployment
(build, then serve `artifacts/poker-dashboard/dist/public` with a fallback to `index.html`).

Built by [Abhay Jhade](https://abhayjhade.com).
