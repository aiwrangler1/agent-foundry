# Local setup

Requirements: Node 24+, pnpm 11+, and a Supabase CLI or dashboard connection
when database work is needed.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Current account state observed in the signed-in browser:

- Supabase already has an `Agent Foundry` organization on the Free plan and an
  existing `Agent Foundry` project. Reuse it after verifying the project owner,
  region, and billing settings.
- Vercel team creation is available, but the current flow is a Pro checkout for
  `$20/month` using the saved payment method. The final Create action was not
  submitted.

Human-only setup still required:

1. Complete GitHub account verification and provide the contact email for the
   new organization, then create the organization and empty repository.
2. Confirm whether the Vercel Pro team at `$20/month` is authorized, or choose
   a different Vercel billing/team path. Confirm the existing Supabase project
   is the intended one before applying migrations.
3. Install/authorize the GitHub repository for Codex with least privilege.
4. Copy the resulting IDs into a local, uncommitted `.env` file.
5. Review the legal-entity ADR with counsel and tax advisors before filing.

No production secret belongs in this repository or in Supabase application data.
