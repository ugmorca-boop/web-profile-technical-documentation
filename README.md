# ORCA web (phase 1 scaffold)
Next.js + Payload CMS + PostgreSQL for ORCA, Gadjah Mada Robotics Team.

**Package manager: pnpm only.** Do not use npm or yarn, and never commit `package-lock.json`.

## Status: UNVERIFIED
These files were written without installing dependencies or running them. Expect to fix small
API differences for the Payload version you install. Check the Payload docs for your version.

## Setup
1. `corepack enable` (ships with Node), then use the Node version in `.nvmrc`.
2. `pnpm dlx create-payload-app@latest orca-web` (template: blank, database: PostgreSQL).
3. Copy this folder's `src/`, `tests/`, `.github/`, `.nvmrc`, `docker-compose.yml`, `SECURITY.md` over the generated
   project (keep the generated `(payload)` route group; replace `payload.config.ts`).
4. Delete any `package-lock.json`, then run `corepack use pnpm@latest`. This writes the exact `packageManager` field
   into `package.json`, which CI and teammates rely on. Commit `pnpm-lock.yaml`.
5. `pnpm add -D vitest`; make sure the `test` and `typecheck` scripts exist.
6. `cp .env.example .env`, then `docker compose up -d db` and `pnpm dev`.
7. Create the first admin at `/admin`, then set its role to `admin` in the database.
8. `pnpm test` runs the unit tests for access and workflow rules.

CI installs with `pnpm install --frozen-lockfile`, so the build fails if `package.json` and the lockfile disagree.

## Roadmap
Phase 2: invite emails, 2FA for staff, term-expiry and inactivity jobs, roster review page.
Phase 3: public pages (story, game, sponsors, contact), Playwright e2e, axe, Lighthouse CI.
Phase 4: security headers/CSP, rate limiting, deployment, backups, docs/ threat model.
