# Security notes
- Invite-only accounts; no public sign-up. Roles enforced server-side in collection access rules.
- Login blocked for suspended/alumni accounts and after term expiry (src/lib/membership.ts).
- Article status changes validated on the server; nobody approves their own article (src/lib/workflow.ts).
- Lockout after 5 failed logins (15 min). Role/status changes are written to audit-logs.
- Article body is stored as structured rich text, not raw HTML.
## Not done yet (see README roadmap)
2FA for editors/admins, invite emails, scheduled term-expiry and inactivity jobs, roster review page,
security headers/CSP, rate limiting on the contact form, breached-password check.
