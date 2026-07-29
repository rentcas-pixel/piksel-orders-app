# AGENTS.md

## Cursor Cloud specific instructions

`piksel-orders-app` is a single Next.js 15 (App Router, React 19, TypeScript) application — an internal back-office system for Piksel (Lithuanian ad-screens company). It is not a monorepo. Package manager is **npm** (`package-lock.json`). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`, `test`).

### Services / how to run
- Single web service: `npm run dev` (Next.js + Turbopack) on http://localhost:3000. Use `npm run lint`, `npm run test` (Vitest), `npm run build` for verification.
- Data backends are **remote/hosted**, not local: PocketBase (core Orders module, default `https://get.piksel.lt`) and Supabase (invoices/bank/email/agency + auth). `src/config/index.ts` hard-codes production fallback URLs + a Supabase anon key, so the app boots and can read live data with **no `.env.local`**. There is no Docker/compose and no local DB to start.

### Non-obvious caveats
- `/` redirects to `/login` (307). The main app requires **Supabase email/password login**; no credentials are committed, so the authenticated UI cannot be exercised without a real account. Server API routes that need `SUPABASE_SERVICE_ROLE_KEY` (e.g. `/api/agency/invoices`, imports) fail without it.
- `/test-pocketbase` is **public** (not in `middleware.ts` matcher) and is the easiest smoke test of core functionality: it fetches live `orders` records from PocketBase. Good no-auth end-to-end check.
- Feature modules gated by env: OpenAI (`OPENAI_API_KEY`) for the email AI agent, Mistral (`MISTRAL_API_KEY`) for invoice OCR, IMAP/SMTP (`EMAIL_PASSWORD`, `mail.piksel.lt`) for the "Paštas" tab. Optional; not needed to run/lint/test/build.
- README references a `.env.example` that is not committed (`.env*` is gitignored). Create `.env.local` manually only when testing the gated modules above.
- `npm run lint` currently reports warnings only (0 errors) — that is the expected baseline.
- Do not run `npm run build` while `npm run dev` is running: both share `.next` and a concurrent build corrupts the dev server (500s / missing `_buildManifest.js.tmp`). Stop dev first, or `rm -rf .next` and restart dev afterward.
