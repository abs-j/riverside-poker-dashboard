# Riverside Poker Dashboard

## Running on Replit

- Use the Run button or the managed workflow `artifacts/poker-dashboard: web`.
- The workflow runs `pnpm --filter @workspace/poker-dashboard run dev` and supplies `PORT` and `BASE_PATH`.
- The app is registered at the root preview path `/`.
- Node.js 22 is configured because the existing tests use Node's TypeScript stripping support.
- Install dependencies with `pnpm install --frozen-lockfile`.
- For local development outside the managed workflow, `pnpm dev` defaults to port 5000.

## Checks

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

Production output is `artifacts/poker-dashboard/dist/public`. The existing static publishing configuration includes an SPA fallback to `index.html`.

## Demo behavior

This is the imported portfolio demo, not the original production poker system. It uses fictional data and intercepts API calls inside the browser. No backend, database, API keys, or session secret are needed.

Choose **Enter the demo** and use any password to explore the dashboard. Live-ledger edits reset on refresh. Preserve the existing demo behavior unless the user requests changes.

## Project structure

Keep the existing pnpm workspace and React/Vite stack. The frontend lives in `artifacts/poker-dashboard`, with its shared API client in `lib/api-client-react`. Artifact metadata is managed through Replit's artifact tools; do not add a duplicate legacy workflow.
