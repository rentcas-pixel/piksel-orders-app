# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`piksel-orders-app` is a single **Next.js 15 (App Router, Turbopack) + React 19 + TypeScript** application. It serves two products from one codebase: the internal back-office at `/` and the agency client portal at `/piksel/agency`. All backend logic lives in Next.js API routes (`src/app/api/**`); there is no separate backend service to run.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`, `test`). Use `npm` (there is a `package-lock.json`).

### Running / testing services
- Dev server: `npm run dev` → http://localhost:3000 (Turbopack). This is the only long-running service.
- Lint: `npm run lint` (ESLint flat config; currently reports warnings only, no errors).
- Tests: `npm run test` (Vitest, unit tests under `src/**/*.test.ts`).
- `next build` (Turbopack) and `next dev` share the `.next` directory — do NOT run a build while the dev server is running, or vice versa. Stop one before starting the other.

### Non-obvious gotchas
- **Points at PRODUCTION backends by default.** `src/config/index.ts` hardcodes fallbacks to the hosted PocketBase (`https://get.piksel.lt`, orders/screens/partners) and hosted Supabase (`https://titkwifsatjemnquyrij.supabase.co`, auth + finance + email + agency). No local databases are needed to run the app, but this means the running dev app reads/writes **real production data**. Avoid mutating operations (creating/editing/deleting orders, invoices, sending email) when testing unless you intend to change production data. Override via `.env.local` (`NEXT_PUBLIC_POCKETBASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to point at your own instances.
- **The whole app is gated behind Supabase email/password login** (`/login`, and `/piksel/agency/login` for the portal). There is no self-signup. Reaching the orders UI, invoices, bank, email, or agency portal requires valid credentials that are not present in the repo/env. Request them as secrets/test-login if you need authenticated end-to-end testing.
- **`/test-pocketbase` is an unauthenticated dev page** that fetches live orders from PocketBase — useful for a read-only smoke test of the core data pipeline without logging in.
- **Optional feature env vars** (set in `.env.local`) enable specific features; the core app runs without them but those features error out:
  - `SUPABASE_SERVICE_ROLE_KEY` — required for finance/agency server APIs and the `scripts/*` utilities.
  - `OPENAI_API_KEY` (`OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`) — "Paštas" AI email agent + embeddings.
  - `MISTRAL_API_KEY` — invoice OCR.
  - `EMAIL_PASSWORD` (+ `EMAIL_IMAP_HOST/PORT`, `EMAIL_SMTP_HOST/PORT`, `EMAIL_USERNAME`) — IMAP/SMTP mailbox (`mail.piksel.lt` defaults).
  - `IMPORT_API_KEY` — auth for the invoice import endpoint.
- Finance/email/agency features assume the Supabase SQL in `supabase/migrations/*.sql` has been applied to whatever Supabase project is targeted.
