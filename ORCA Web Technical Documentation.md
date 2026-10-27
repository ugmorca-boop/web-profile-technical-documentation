# ORCA Web: Technical Documentation

Version 0.1 (draft) · Project: ORCA, Gadjah Mada Robotics Team (UGM)

This document describes the planned architecture of the ORCA website and member publishing system. It separates what exists in the phase 1 scaffold from what is only planned, and lists open questions that must be answered before launch.

## 1. Purpose and goals

ORCA builds underwater robots. The website has two jobs:

1. **Public profile.** Present ORCA to professionals (sponsors, partners, media, recruiters): landing page, homepage, our story, mini game, sponsor and partnership page, contact.
2. **Member publishing.** Let verified ORCA members write technical articles that an editor reviews before they go public.

**Non-goals for the first release:** public user registration, comments, e-commerce, real-time features, UGM SSO (see section 7 for why).

**Quality goals:** fast on mobile, accessible (WCAG 2.2 AA target), secure by default, maintainable by rotating student teams, and documented well enough to serve as a portfolio piece.

## 2. Status of this document

| Area | Status |
| --- | --- |
| Members, Articles and Audit log collections | Written in the phase 1 scaffold; **not yet run or verified** |
| Sign-in and article workflow rules (pure functions) | Written with unit tests; **tests not yet run** in a full install |
| Design tokens and starter homepage | Written |
| CI workflow, Docker Compose, env template | Written; **not yet run** |
| Invite emails, two-factor login, scheduled expiry jobs, roster page | **Planned** (phase 2) |
| Public pages, mini game, sponsor and contact pages, e2e tests | **Planned** (phase 3) |
| Security headers, rate limiting, deployment, backups | **Planned** (phase 4) |

A separate, earlier single-file HTML prototype exists. It demonstrates the visual concept only and contains no real authentication.

## 3. Architecture

```
Browser
  │  HTTPS
  ▼
Reverse proxy / host (TLS, security headers)
  │
  ▼
Next.js application (App Router, TypeScript)
  ├─ Public pages (server-rendered / static)
  ├─ Member area (authenticated routes)
  ├─ Payload CMS (admin panel + REST/GraphQL API, embedded)
  │
  ▼
PostgreSQL  ◄── scheduled backups
  │
Transactional email provider (invites, password resets)
```

Payload CMS runs inside the same Next.js project. This means one repository, one language and one deployable unit, which keeps operations simple for a student team.

**Key design principle:** authorisation lives in your own data (roles, status, term), not in the login method. Login can change later without changing who is allowed to do what.

## 4. Technology choices

| Concern | Choice | Reason |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Fast public pages plus app-like member area |
| Styling | Tailwind CSS with design tokens | Consistent system, small CSS |
| CMS and auth | Payload CMS (built-in authentication) | Roles, drafts, admin panel, in-project |
| Database | PostgreSQL 16 | Relational integrity, migrations |
| Rich text | Lexical (Payload's editor), stored as JSON | Avoids storing raw HTML |
| Unit/integration tests | Vitest | Fast, TypeScript-native |
| End-to-end tests | Playwright + axe | Real browser flows and accessibility checks |
| CI/CD | GitHub Actions | Free for typical use. Package manager for the whole project: pnpm (see D6 in section 18) |
| Containers | Docker | Reproducible local and production setup |

Package versions and some Payload APIs change between releases. Pin exact versions in `package.json` and check the official documentation for the installed version before relying on any API shown here.

## 5. Repository structure

```
orca-web/
├─ src/
│  ├─ payload.config.ts        # CMS configuration
│  ├─ access/index.ts          # reusable access helpers (isAdmin, isStaff, isSignedIn)
│  ├─ collections/
│  │  ├─ Members.ts            # accounts, roles, status, term
│  │  ├─ Articles.ts           # articles and review workflow
│  │  └─ AuditLogs.ts          # append-only security log
│  ├─ lib/
│  │  ├─ membership.ts         # canSignIn, isInactive (pure functions)
│  │  └─ workflow.ts           # canTransition (pure function)
│  └─ app/(frontend)/          # public pages and design tokens
├─ tests/                      # Vitest unit tests
├─ e2e/                        # Playwright tests (planned)
├─ docs/                       # decision records, threat model (planned)
├─ .github/workflows/ci.yml
├─ docker-compose.yml          # local Postgres
├─ .env.example
└─ SECURITY.md
```

Business rules are kept in `src/lib` as pure functions with no framework imports. This makes them easy to test and means the CMS hooks only call them.

## 6. Data model

### 6.1 Members (authentication enabled)

| Field | Type | Notes |
| --- | --- | --- |
| email | text, unique | Set by admin at invite time |
| password | hashed | Managed by Payload; never stored in plain text |
| name | text | Required |
| role | select: member, editor, admin | Only an admin can change it |
| status | select: active, suspended, alumni | Only an admin can change it |
| termEndsAt | date | Access ends after this date unless renewed |
| lastActiveAt | date | Set on login; read-only; visible to staff |

Login settings in the scaffold: 8-hour session token, lockout for 15 minutes after 5 failed attempts.

### 6.2 Articles

| Field | Type | Notes |
| --- | --- | --- |
| title | text, max 160 | Required |
| slug | text, unique, indexed | Required |
| team | select | mechanical, electrical, control, software |
| author | relationship to Members | Set from the signed-in user on create; read-only |
| status | select | draft, submitted, approved, published |
| body | rich text (JSON) | Required |
| reviewNote | textarea | Editor feedback |

### 6.3 Audit logs

Fields: action, actor, target, detail (JSON). Created only by server code; the API refuses create, update and delete from any user. Only admins can read. The scaffold logs role and status changes; the plan extends this to invites, suspensions, publishing and sign-in failures.

### 6.4 Planned collections (phase 3)

Events, Partners, Sponsor tiers, Contact inquiries, and a Site settings global (counters, social links).

## 7. Authentication and account lifecycle

### 7.1 Decision

UGM SSO was the first idea but may require approval from UGM's IT unit, which is uncertain. Google sign-in restricted to UGM addresses was considered, but it was not confirmed that UGM mailboxes work that way. The team chose **invite-only passwords managed by Payload**, with an admin who reviews accounts regularly. The login method is kept separate from the roles and status model so SSO or Google sign-in can be added later without migrating accounts.

### 7.2 Lifecycle

1. **Invite.** An admin creates the member (name, email, role, term end). *Planned:* the system emails a single-use, short-lived link and the member sets their own password. Until that exists, the admin must set an initial password and force a reset.
2. **Sign in.** `beforeLogin` calls `canSignIn`: the account must be `active` and the term must not have ended. Otherwise login is refused with a generic message.
3. **Active use.** `lastActiveAt` is updated on login.
4. **Renewal.** Each term, an admin renews active members in bulk by extending `termEndsAt`. *Planned:* a roster page for this.
5. **Offboarding.** An admin sets the status to `suspended` or `alumni`. Existing sessions must stop working (to be verified in testing; see section 11).
6. **Automatic safeguards (planned):** accounts inactive for 90 days are suspended, accounts past their term are suspended, and the admins receive an email digest.

### 7.3 Password and session controls

- Hashing handled by Payload; minimum length of 12 characters and a breached-password check are **planned**, not yet configured.
- Lockout after 5 failures for 15 minutes (configured).
- Password reset by short-lived single-use email link, with a generic response that does not reveal whether an email exists (verify the behaviour of the installed Payload version).
- Secure, HttpOnly, SameSite cookies and HTTPS only in production.
- **Two-factor authentication required for editors and admins (planned).** Payload does not provide this out of the box in all versions, so the approach (plugin or custom) must be decided in phase 2.
- Recovery codes for admins kept offline by two named people.

## 8. Roles and permissions

| Action | Public | Member | Editor | Admin |
| --- | --- | --- | --- | --- |
| Read published articles | Yes | Yes | Yes | Yes |
| Read own drafts | No | Yes | Yes | Yes |
| Read all articles | No | No | Yes | Yes |
| Create article | No | Yes | Yes | Yes |
| Edit own article (draft or submitted) | No | Yes | Yes | Yes |
| Edit any article | No | No | Yes | Yes |
| Submit own draft for review | No | Yes | Yes | Yes |
| Approve or publish others' articles | No | No | Yes | Yes |
| Approve or publish own article | No | No | No | No |
| Delete article | No | No | No | Yes |
| Read member list | No | Own record | Yes | Yes |
| Create or change members, roles, status | No | No | No | Yes |
| Read audit log | No | No | No | Yes |
| Access admin panel | No | No | Yes | Yes |

All rules are enforced on the server in collection access functions and hooks. Hiding buttons in the interface is never treated as a control.

## 9. Article workflow

States: `draft` → `submitted` → `approved` → `published`.

| From | To | Who |
| --- | --- | --- |
| draft | submitted | Author only |
| submitted | draft | Author, or staff requesting changes |
| submitted | approved | Staff, not the author |
| approved | published | Staff, not the author |
| published | approved (unpublish) | Staff, not the author |

Any other change is refused. The rule lives in `canTransition` and is called from the Articles `beforeChange` hook, so it applies to the admin panel, the API and any future member editor alike. On create, the author is forced to the signed-in user and the starting state is `draft`.

**Known gap:** an admin who is the author cannot publish their own article, which is intended, but a small team may need a documented emergency procedure (for example, a second admin).

## 10. Public site and design system

### 10.1 Pages

| Page | Purpose | Key content |
| --- | --- | --- |
| Landing | First impression | One headline, one call to action |
| Homepage | Proof | Real numbers, three pillars, upcoming events, partners |
| Our story | Credibility | Timeline of milestones, values, photos |
| Journal | Expertise | Published member articles, filter by team |
| Mini game | Engagement | "Hold depth": keep an ROV in a moving depth band for 30 seconds |
| Sponsors and partnership | Conversion | Audience snapshot, three tiers, media kit, enquiry |
| Contact | Conversion | Form with a purpose dropdown that changes the fields |
| Member area | Publishing | Sign in, my articles, editor |

All numbers, dates and milestones in the prototype are placeholders and must be replaced with real content.

### 10.2 Visual concept: "The Descent"

The page gets darker with depth, like diving, and sections map to depth. Tokens in the scaffold: surface `#e8f5f2`, shallow `#b9dde0`, mid `#0f4a5c`, deep `#0a3445`, abyss `#031219`, ink `#06202b`, buoy-orange accent `#ff6a2b`. Typefaces: Instrument Serif for headlines and Hanken Grotesk for text. Motion is limited and disabled when the user prefers reduced motion. Check that every text and background pair meets AA contrast, and check the orange accent on dark sections in particular.

### 10.3 Content rules

- Article bodies are rendered from structured JSON, never injected as raw HTML.
- Images get required alt text and are resized and compressed on upload.
- The mini game must work with touch and keyboard, and must not trap focus.

## 11. Security

### 11.1 Assets and threats

| Asset | Threat | Control |
| --- | --- | --- |
| Admin accounts | Stolen password, phishing | Mandatory two-factor (planned), lockout, audit log, alerts on new admins |
| Member accounts | Credential stuffing, leavers keeping access | Lockout, term expiry, inactivity suspension, review process |
| Article content | Stored cross-site scripting | Structured rich text, sanitised render, content security policy, editor review |
| File uploads | Malicious files | Type and size limits, re-encode images, serve from a separate origin if possible |
| Contact form | Spam, abuse | Honeypot or Turnstile, rate limiting, server validation |
| Database | Injection, data loss | ORM with parameterised queries, least-privilege DB user, tested backups |
| Secrets | Leaks | Environment variables or a secrets manager; secret scanning in CI |
| Dependencies | Vulnerable packages | Dependabot or Renovate, `npm audit` in CI |

### 11.2 Baseline controls

- HTTPS everywhere with HSTS; content security policy and other standard security headers (**planned**).
- Server-side validation of all input with a schema library such as Zod for custom endpoints.
- CSRF protection on state-changing requests; verify what the installed Payload version provides and add a check where needed.
- Rate limiting on login, password reset, contact form and article submission (**planned**).
- Roles and status checked on the server in every request, not only at login. **To test:** that a suspended member's existing session stops working immediately, because the scaffold only blocks new logins in `beforeLogin`.
- Generic error messages on login and reset.

### 11.3 Not covered

This plan is a sensible baseline, not a security audit. Before launch, have someone else review the authentication setup, access rules and deployment. Penetration testing is out of scope.

## 12. Testing strategy

| Layer | Tool | Examples |
| --- | --- | --- |
| Unit | Vitest | `canSignIn`, `isInactive`, `canTransition` (written, 14 cases) |
| Integration | Vitest + test Postgres | Access rules per role; workflow through the API; lockout |
| End to end | Playwright | Admin invites member; member submits; editor approves; article appears publicly |
| Accessibility | axe in Playwright + manual keyboard pass | Every public page and the member editor |
| Performance | Lighthouse CI | Budgets that fail the build on regression |

**Negative cases that must be tested:** suspended or alumni member signing in; expired term; invite link used twice or after expiry; member editing someone else's article; member publishing; editor approving their own article; reset form leaking whether an email exists; old session after suspension.

Targets (to confirm after measurement, not promises): Lighthouse above 90 on public pages, zero serious axe violations, and unit coverage reported in the README.

## 13. Environments, CI/CD and deployment

- **Local:** `docker compose up -d db`, copy `.env.example` to `.env`, run the dev server.
- **Staging:** same configuration as production with test data; used for end-to-end tests and the pre-launch review.
- **Production:** Docker on a VPS, or a managed platform if UGM does not require its own infrastructure. **Open question:** whether a `ugm.ac.id` subdomain or UGM hosting is required.
- **CI (scaffold):** pnpm install with a frozen lockfile, type check, unit tests, pnpm audit. **Planned additions:** lint, Playwright, axe, Lighthouse CI, CodeQL or Semgrep, secret scanning.
- Merging to the main branch requires passing CI. Deployments run from tagged builds.
- Database changes go through migrations, never manual edits on production.

### Configuration

| Variable | Purpose |
| --- | --- |
| DATABASE\_URI | PostgreSQL connection string |
| PAYLOAD\_SECRET | Signing secret; long and random; different per environment |
| Email provider keys | For invites and resets (phase 2) |

## 14. Operations

- **Backups:** automated daily database backups, kept off the server, with a restore tested at least once before launch and again each year.
- **Monitoring:** uptime check, error tracking, and an alert for repeated failed logins.
- **Email delivery:** a dedicated transactional provider with SPF, DKIM and DMARC set up. Test with real UGM addresses before launch. The admin panel should offer "resend invite" and show delivery status; a one-time invite link sent by WhatsApp is the fallback.
- **Semester checklist (admins):** review the roster, renew or suspend accounts, review the inactive-account digest, check the audit log, rotate any shared credentials, confirm backups.
- **Offboarding:** whoever removes a person from the team group also suspends their account the same day.
- **Two named admins** at all times, each holding recovery codes offline.

## 15. Privacy

Stored personal data: member name, email, role, status, last activity, and audit entries; contact form submissions; article authorship. Collect no more than this. Publish a short privacy notice that states what is stored, why, who can see it, how long it is kept, and how to ask for deletion. Delete contact form inquiries after a defined period (for example 12 months). Do not collect analytics that identify individuals without a stated need. The team should confirm any obligations that apply under Indonesian law and UGM policy.

## 16. Roadmap

**Phase 1 (scaffold delivered):** collections, access rules, workflow rules, tests, CI, tokens, starter page. Next step is to install and verify it.

**Phase 2 (member system):** invite emails, two-factor for staff, term-expiry and inactivity jobs, roster page, password policy, session invalidation on suspension, audit log extensions.

**Phase 3 (public site):** all public pages, mini game, sponsor and contact flows, member article editor, Playwright, axe, Lighthouse CI.

**Phase 4 (hardening and launch):** security headers and CSP, rate limiting, upload handling, deployment, backups and restore test, threat model and decision records in `docs/`, external review.

## 17. Open questions and assumptions

1. Does UGM require hosting or a domain under its own infrastructure?
2. Will UGM IT approve SSO later? (The design allows it.)
3. Which email provider and sending domain will be used?
4. Who are the two admins, and who holds recovery codes?
5. Which Payload and Next.js versions will be pinned, and does the scaffold match their APIs?
6. How should two-factor be implemented for Payload staff accounts?
7. What are the real content, numbers, photos, logo and brand colours?
8. What are the sponsor tier prices and benefits?
9. Is the mini game's leaderboard needed? If yes, it needs storage, abuse protection and a privacy decision.
10. What is the content licence for member articles, and who owns them?

## 18. Decision records (to be written in `docs/`)

- D1: Next.js with embedded Payload CMS.
- D2: Invite-only passwords instead of SSO, with a provider-agnostic account model.
- D3: Business rules as pure functions.
- D4: Structured rich text instead of raw HTML.
- D5: Append-only audit log written only by server code.
  - D6: pnpm is the only package manager, selected through Corepack with the exact version in the `packageManager` field of `package.json`. One lockfile (`pnpm-lock.yaml`) is committed and no `package-lock.json` is allowed. CI and Docker install with `--frozen-lockfile`. Reason: faster installs and stricter dependency resolution. Cost: maintainers need Corepack, which ships with Node, so the README says so on its first line.

## 19. Cookies and browser storage policy

**Principle:** public visitors receive no cookies. The only cookie the site sets is the sign-in cookie for members and staff. This keeps the site free of a consent banner, but it only holds if the rules below are followed in every release.

### 19.1 Allowed

| Item | Who gets it | Purpose | Requirements |
| --- | --- | --- | --- |
| Session cookie set by the CMS on login | Signed-in members and staff only | Keeps the person signed in | HttpOnly, Secure, SameSite (Lax or stricter), expires with the session lifetime (8 hours in the scaffold), deleted on sign-out. Check the exact cookie name and flags in the installed Payload version. |
| Short-lived security tokens (password reset, invite links) | Members | Account security | Single-use, expire quickly, are sent by email and are not stored as cookies |
| In-memory state (for example the mini game score) | Everyone | Function | Lost on page reload; nothing is written to the browser |

### 19.2 Not allowed without a documented decision

- Advertising, retargeting or social tracking pixels.
- Analytics that set cookies or identify individuals. If visitor numbers are needed, use a cookieless tool (for example Plausible or Umami) and record the choice as a decision record.
- Third-party embeds that load before the visitor asks for them (YouTube, maps, social feeds). Use a plain link or a click-to-load placeholder that explains what will be loaded.
- Remote font or script hosts. Fonts are self-hosted at build time (for example with `next/font`), and there are no third-party scripts on public pages. Note that the earlier HTML prototype loaded Google Fonts; the real build must not.
- CAPTCHA or spam services that set cookies or track visitors. The contact form uses a honeypot field, server validation and rate limiting. If a service is added later, check its cookie behaviour first.
- Saving anything in `localStorage` or `sessionStorage` on public pages. If the mini game later stores a best score or a leaderboard name, document it here and in the privacy notice first.

### 19.3 Privacy notice requirements

The privacy notice (section 15) must state, in plain language:

1. That public pages set no cookies.
2. That signing in sets one strictly necessary cookie, what it does and when it expires.
3. What the contact form collects, why, and how long messages are kept.
4. That server logs may record IP addresses and request times for security, and how long they are kept (set a retention period and apply it to the hosting provider's logs too).

### 19.4 Verification

- **Automated test (Playwright):** load every public page in a fresh browser context and assert that the response sets no cookies and that `localStorage` and `sessionStorage` are empty. This test runs in CI and fails the build if a cookie appears.
- **Network check:** the same test records requests and fails if any public page contacts a host other than the site's own domain.
- **Authenticated check:** after sign-in, assert that exactly one session cookie is set with HttpOnly, Secure and SameSite flags, and that it is removed after sign-out.
- **Release checklist:** before each release, review new dependencies and embeds for cookies, storage and external requests.

### 19.5 Legal note

The team collects personal data through member accounts and the contact form, so Indonesian data protection law (UU PDP) and UGM policy may apply. This section is a technical policy, not legal advice. Confirm the obligations with UGM or a qualified adviser before launch, and revisit this section if any cookie, analytics tool or third-party embed is added.

## 20. Language and content style

### 20.1 Decision

The site is **English only**, and all content is written by the team in English. This replaces an earlier draft that planned Indonesian and English versions. English-only halves the writing, review and testing work, and removes the translation workflow. The trade-off is that some local visitors (for example small local sponsors or UGM staff) may be less comfortable reading English, so the writing must be plain and clear. No machine translation is used, and no content is sent to a translation service, which is consistent with the no-third-party-requests rule in section 19.

### 20.2 Keeping the option to add Indonesian later

Adding a second language later is much cheaper if the structure allows it from the start. These costs are small now:

- All interface text (menus, buttons, form labels, error messages, emails) lives in one message file, for example `messages/en.json`, and is never hard-coded in components.
- The page's `lang` attribute is set to `en` from one place in the layout.
- URLs have **no language prefix** (for example `/story`, not `/en/story`). If Indonesian is added later, the routing library (such as `next-intl`; confirm compatibility with the installed Next.js version) can add a prefix and redirect the old English URLs.
- Content fields in the CMS are not localised now. Payload supports field localisation, but enabling it later means a data migration, so decide in section 20.6 if that risk is acceptable.

### 20.3 Writing rules

| Rule | Standard |
| --- | --- |
| Style | Plain English, short sentences, active voice; explain a technical term the first time it appears |
| Spelling | One variant used everywhere (this document uses British spelling, for example "organisation"); the team confirms it in 20.6 |
| Technical terms | One shared glossary in `docs/glossary.md` (thruster, buoyancy, hull, depth hold, and so on) so the same term is used on every page |
| Dates | Written in full and unambiguous: 27 October 2026 |
| Times and events | State the time zone (WIB, UTC+7) on every event |
| Units | Metric units, with the unit always written (m, kg, V) |
| Names | Use official names: Universitas Gadjah Mada, Gadjah Mada Robotics Team |
| Indonesian words | Mark any Indonesian phrase in the HTML with `lang="id"` so screen readers pronounce it correctly |

### 20.4 Review process

1. The author writes the text.
2. A second person who is comfortable in English proofreads it for clarity, spelling and consistency with the glossary. The author never approves their own public text.
3. For public pages and legal pages, an admin gives the final approval. The editor workflow in section 9 already enforces this for articles.
4. Member articles are written in English by members who may not be native speakers. Editors check clarity, and may return an article with a review note asking for a simpler rewrite. Editors should judge the technical content separately from the language, so a good idea is not rejected only because of grammar.

### 20.5 Search, sharing and testing

- Titles, descriptions and social preview text are written in English for every page.
- Continuous integration runs a spelling check on message files and content templates, and an accessibility check that confirms the `lang` attribute is present on every page.
- Layout is tested with long English words and headings so nothing overflows on small screens.

### 20.6 Open decisions

1. Confirm the spelling variant (British or American).
2. Name the person or role who proofreads public text and who owns the glossary.
3. Is an English-only privacy notice acceptable for Indonesian visitors whose personal data is collected? Confirm with UGM or a qualified adviser (section 19.5), because a notice people cannot easily read may not meet the purpose of having one.
4. If sponsors or local partners ask for it, plan a short Indonesian summary of the sponsor page first, which is the smallest useful step.
5. Accept or reject enabling field localisation in the CMS now, to avoid a later migration.

## 21. Handover and maintainability

ORCA's team changes every year, so the site must keep working when the people who built it leave. The goal of this section: a new maintainer with normal Next.js skills can run, change and deploy the site within one working day, and no single person holds knowledge or access that nobody else has.

### 21.1 Ownership

| Item | Owner role | Backup | Notes |
| --- | --- | --- | --- |
| Domain name | Team advisor or lecturer | Second admin | Register under a role-based or institutional account, never a student's personal one |
| Hosting account | Team advisor or lecturer | Second admin | Enable two-factor; set a billing contact that does not change yearly |
| Code repository (GitHub organisation) | Two admins | Advisor | Use an organisation, not a personal account; at least two owners |
| Email sending provider and DNS | Tech lead | Second admin | Document SPF, DKIM and DMARC records |
| CMS admin accounts | Two named admins | Advisor holds sealed recovery codes | See section 14 |
| Backups | Tech lead | Second admin | Stored in a place both admins can access |

Rule: every account in this table has a named person and a named backup, recorded in `docs/ownership.md`. A role changes hands in writing during handover.

### 21.2 Documentation in the repository

- `README.md`: what the project is, how to run it locally, how to run tests. Target: a new developer gets it running in under an hour.
- `CONTRIBUTING.md`: branching, commit and pull request rules, code style, how to add a page, a collection or interface text.
- `docs/architecture.md`: a short version of this document, kept in sync.
- `docs/decisions/`: one short decision record per major choice (see section 18), written when the decision is made.
- `docs/runbook.md`: deploy, roll back, restore a backup, rotate secrets, suspend an account, regain admin access.
- `docs/ownership.md` and `docs/glossary.md` as above.
- `SECURITY.md`: how to report a problem, and which controls exist.

This technical documentation is the source for these files; when something changes, change it in the repository first and update the shared copy afterwards.

### 21.3 Development workflow

- Work happens in branches and pull requests. Direct pushes to `main` are blocked.
- Every pull request needs CI to pass and at least one review from someone other than the author. Changes to authentication, access rules or deployment need review by a second admin.
- Commit messages follow a simple convention (for example Conventional Commits) so a change history can be read later.
- Releases are tagged. Deploys come from tags, and the previous release can be redeployed in one step.
- Dependencies are updated by an automated tool (Dependabot or Renovate) in small, regular pull requests. A dependency that was not updated for a long time is much harder to update later, so budget a short maintenance session each month.
- Keep the dependency list short. Each new package needs a stated reason in its pull request.

### 21.4 Keeping the code understandable

- Business rules stay in `src/lib` as pure, tested functions (section 5).
- Strict TypeScript, linting and formatting are enforced in CI, so style is not a matter of opinion.
- Pin the Node.js version (for example in `.nvmrc`) and package versions with a lockfile.
- Every environment variable is documented in `.env.example` with a one-line description.
- Avoid clever code. Prefer plain, readable solutions a student in their second year can follow.

### 21.5 Annual handover process

Run this every year, ideally a month before the outgoing team leaves:

1. The outgoing tech lead walks the incoming team through the repository, the runbook and a live deploy. The incoming team performs the next deploy themselves.
2. Transfer ownership of accounts in 21.1 and update `docs/ownership.md`.
3. Rotate shared secrets and passwords, and remove access for people leaving.
4. Suspend or move departing members to alumni (see section 7).
5. Restore a backup into a test environment to prove it works.
6. Review open issues, the roadmap and the open questions in section 17.
7. Record the date and who attended in `docs/handover-log.md`.

### 21.6 Cost and continuity

- Keep a one-page list of recurring costs (domain, hosting, email provider, any paid tools), who pays, and when each renews. An expired domain or card is one of the most common reasons a student site disappears.
- Prefer services with free or low-cost tiers and simple exports, so the site can move to another host without a rewrite.
- Document an exit plan: how to export the database and uploaded files, and how to redeploy on a different host.

### 21.7 Maintenance schedule

| When | Task |
| --- | --- |
| Weekly | Review and merge dependency update pull requests; check the editor's review queue |
| Monthly | Review security alerts, uptime and error reports; confirm backups ran |
| Each term | Run the member review (section 14), renew or suspend accounts, update team and event content |
| Yearly | Full handover (21.5), restore test, review costs, review this documentation |

### 21.8 Open decisions

1. Which person or role will hold the domain and hosting accounts?
2. Who is the first tech lead and the first backup?
3. Is there a lecturer or advisor willing to hold recovery codes and institutional account ownership?
4. Where will the shared documentation and ownership records be stored so both admins can always reach them?

## 22. Testing methodology and protocol

This section extends section 12. It states which development method applies to which part of the system, the order of testing, and what counts as done. The scaffold has never been run, so the first task is to make it compile and pass its existing tests.

### 22.1 Methods and where they apply

| Method | Idea | Applies to | Evidence to keep |
| --- | --- | --- | --- |
| TDD (test-driven) | Write a failing test, write the minimum code to pass, then clean up | Pure rules in `src/lib` (sign-in, inactivity, workflow, term expiry) | Commit history showing the test before the code |
| BDD (behaviour-driven) | Describe behaviour as Given, When, Then; the scenarios become tests | Member, editor and admin flows (Playwright) | Scenario names readable by non-developers |
| ATDD (acceptance-test-driven) | Agree acceptance criteria before building a feature; the feature is done when they pass | Each roadmap feature | Criteria written in the issue before work starts |
| SDD (specification-driven) | The written specification is the source; tests are derived from it | Permission table (section 8), workflow table (section 9), data model (section 6) | Tests generated from or checked against the tables |
| Regression testing | Every fixed bug gets a test that failed first | All code | Test linked to the bug issue |
| Property-based testing | State a rule that must hold for all inputs; the tool tries many | Term and inactivity logic | Properties listed in the test file |
| Mutation testing | Change the code on purpose; tests should notice | `src/lib`, run once before launch | Reported mutation score |
| Exploratory testing | Unscripted use by someone who did not build it | Whole site before launch | Notes in the test log |

Only claim a method in the README if it was actually used for that part of the work.

### 22.2 Test protocol, in order

Do not start a step until the previous one passes.

| Step | Action | Pass condition |
| --- | --- | --- |
| 1. Make it run | Install dependencies; run type check and existing unit tests; fix version differences in Payload and Next.js | Compiles; all existing tests pass |
| 2. Rule tests (TDD) | Cover every allowed and refused case of the pure functions, including boundaries (term ends today, exactly 90 days inactive) | All cases in sections 7 and 9 covered |
| 3. Access tests (SDD) | Against a separate test database, run each action as public, member, other member, editor, admin; compare with the table in section 8 | Results match the table exactly |
| 4. Account lifecycle | Invite, first sign-in, five failed logins and lockout, suspension, expired term, password reset | Every refusal gives a generic message; no email enumeration |
| 5. Behaviour scenarios (BDD) | Playwright runs the scenarios in 22.3 on desktop and phone-sized screens | All scenarios pass |
| 6. Cookies and requests | Automated checks from section 19.4 | No cookies on public pages; no requests to other hosts |
| 7. Accessibility | axe on every page; keyboard-only run through the site; screen reader check of sign-in and editor | No serious axe violations; no keyboard traps |
| 8. Performance | Lighthouse with mobile throttling; check on a real phone | Meets budgets set before testing |
| 9. Security self-test | The attacks listed in 22.6 | None succeeds, or each finding is fixed and retested |
| 10. Pre-launch | Staging deploy; backup restore into a fresh database; invite emails to real UGM addresses; exploratory session by a teammate | All succeed; findings logged |

**Rules for the access tests.** Use a real test database, not mocks. Payload's server-side API may skip access rules by default, so tests must switch that off (check the exact option for the installed version; it is believed to be `overrideAccess: false`). A test that bypasses the rules proves nothing.

### 22.3 BDD scenarios

These are written as plain-language behaviour. They can live as test names and comments in Playwright. A dedicated tool such as Cucumber is only worth adding if non-developers will read and edit them.

```gherkin
Feature: Article review workflow

  Scenario: Member submits own draft
    Given an active member with a draft article
    When the member submits it for review
    Then its status is "submitted"
    And it appears in the editor's review queue

  Scenario: Member cannot publish
    Given an active member with a submitted article
    When the member tries to set its status to "published"
    Then the change is refused

  Scenario: Editor cannot approve own article
    Given an editor who wrote a submitted article
    When the editor tries to approve it
    Then the change is refused

  Scenario: Editor approves and publishes another member's article
    Given a submitted article written by a member
    When an editor approves it and then publishes it
    Then it is visible to the public

Feature: Account access

  Scenario: Suspended member cannot sign in
    Given a member whose status is "suspended"
    When they enter the correct password
    Then sign-in is refused with a generic message

  Scenario: Suspension ends an open session
    Given a signed-in member with an open session
    When an admin suspends the member
    Then the member's next request is refused

  Scenario: Expired term
    Given an active member whose term ended yesterday
    When they try to sign in
    Then sign-in is refused

  Scenario: Lockout
    Given an active member
    When they enter a wrong password five times
    Then further attempts are refused for 15 minutes

  Scenario: Member cannot edit another member's article
    Given two members and a draft written by the first
    When the second member tries to edit it through the API
    Then the request is refused

  Scenario: Reset does not reveal accounts
    Given an email address with no account
    When someone requests a password reset for it
    Then the response is the same as for an existing account

Feature: Public pages

  Scenario: No cookies for visitors
    Given a new visitor
    When they open any public page
    Then no cookie is set and no request goes to another host
```

The scenario "Suspension ends an open session" is expected to **fail** on the current scaffold, because only new sign-ins are checked (section 11.2). Write it first, watch it fail, then fix it.

### 22.4 Acceptance criteria template (ATDD)

Before building any roadmap feature, write the following in its issue and get one other person to confirm it:

1. **Goal:** one sentence, from the user's point of view.
2. **Acceptance criteria:** three to five checks, each pass or fail.
3. **Out of scope:** what this feature will not do.
4. **Negative cases:** at least two things that must be refused.
5. **Tests:** which unit, integration or behaviour tests prove each criterion.

The feature is done when every criterion passes in CI and the documentation is updated.

### 22.5 Specification-derived tests (SDD)

- Keep the permission matrix (section 8) and workflow table (section 9) as data in the repository, for example a small TypeScript or JSON file, and write the tests as loops over that data. One row in the data becomes one test.
- When a rule changes, change the data first, watch the affected tests fail, then change the code. This keeps the documentation and the system from drifting apart.
- When AI tools help write code, the specification and tests decide whether the output is accepted. Run the tests and read the code before trusting it.
- Property examples: a suspended member can never sign in, for any date; a member can never reach `published` through any sequence of allowed transitions; an article's author never changes after creation.

### 22.6 Security self-test (step 9)

These are basic checks, not a professional penetration test.

1. Call the API directly, without the interface, and attempt actions the role should not allow, including changing another person's article by its id.
2. Submit article content containing a script tag and an image with an error handler; confirm nothing runs when it is displayed.
3. Upload a file with a wrong type and an oversized file.
4. Send many requests quickly to sign-in, reset and the contact form to check rate limiting (once implemented).
5. After deployment, check security headers with an online scanner.
6. Run the dependency audit and review every high or critical finding.
7. Try to read the audit log and member list as a normal member.
8. Attempt to change your own role through the API.

### 22.7 Test log and regression habit

Keep `docs/test-log.md` with one entry per test session: date, who tested, scope, result, bugs found, and the commit that fixed each. Every bug fix starts with a test that reproduces the bug. Bugs found and fixed are good evidence of the process; do not delete them to look cleaner.

### 22.8 Gates and definition of done

| Gate | Requirement |
| --- | --- |
| Pull request | Type check, lint, unit and integration tests, dependency audit all pass; at least one review; new rules have tests written first |
| Release | End-to-end, cookie, accessibility and performance checks pass; test log updated |
| Launch | Steps 1 to 10 complete; backup restore proven; open findings listed with owners |

A feature is done when its acceptance criteria pass, negative cases are tested, the documentation is updated and the test log records any bugs found.

### 22.9 Open decisions

1. Performance budgets (page weight, Lighthouse scores): set them before step 8, not after measuring.
2. Whether to use Cucumber or keep BDD as plain Playwright test names.
3. Who performs the exploratory session and the keyboard and screen reader checks.
4. Which test database and email test service the team will use in CI.
