# Security controls

- Production writes are disabled by default.
- All tools are registered and action-classed; gateway checks are deny-by-default.
- Spend authority is short-lived, scoped to agent/workflow/tool/budget, and
  idempotency-bound.
- Secrets, authentication state, approval authority, and unscoped private data
  are excluded from caches.
- External pages, emails, documents, customer messages, and tool responses are
  untrusted content. They can be evidence but never policy or authority.
- RLS is enabled on organization-scoped tables; application roles must be
  supplied by a trusted server-side identity boundary.
