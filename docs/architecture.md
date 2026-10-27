# Architecture (summary)
Next.js (App Router, TypeScript) with Payload CMS embedded, PostgreSQL, a transactional email provider.
Authorisation lives in our own data (role, status, term), not in the login method.
Business rules are pure functions in `src/lib`, tested with Vitest.

Full version: export the shared technical documentation as Markdown and replace this file.
Keep this file in sync with the code; change the repository first, then the shared copy.
