# Local setup

Requirements: Node 24+, pnpm 11+, and a Supabase CLI or dashboard connection
when database work is needed.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Legal and account identity:

- The planned legal container is ARTJ LLC in New York. Use ARTJ LLC for the
  bank account, EIN, taxes, contracts, and payment processors after formation.
- “Agent Foundry” is only the technical control-plane/repository name. A
  Supabase, GitHub, or Vercel project may retain that technical label without
  making it a legal entity or public master brand.
- Use `© 2026 ARTJ LLC. This website/shop is owned and operated by ARTJ LLC.`
  in public control-plane or product surfaces where a legal disclosure is
  appropriate.

Current account state observed in the signed-in browser:

- Supabase already has an organization and project using the `Agent Foundry`
  technical label on the Free plan. Reuse it only after verifying the project
  owner, region, billing settings, and whether the billing/contact identity
  should be ARTJ LLC after formation.
- Vercel team creation is available, but the current account policy is to use
  the existing `Ai Wrangler's projects` Hobby team. No new Vercel team, paid
  plan, charge, or seat should be created without separate approval.

Vercel is the v1 runtime/hosting choice, not the agent harness. The intended
boundary is Codex/OpenCode through `HarnessAgent`, Vercel Workflows through
`WorkflowEngine`, Vercel Sandbox through `SandboxProvider`, and the Next.js
control panel on Vercel. Risky tools remain behind the deterministic gateway.

Human-only setup still required:

1. Complete GitHub account verification and provide the contact email for the
   new organization, then create the organization and empty repository.
2. Use the existing Vercel Hobby team and existing Supabase project. Confirm
   the existing Supabase project is the intended one before applying migrations.
3. Install/authorize the GitHub repository for Codex with least privilege.
4. Copy the resulting IDs into a local, uncommitted `.env` file.
5. Review `docs/adr/0001-legal-entity-structure.md` and
   `docs/legal-identity.md` with New York counsel and a CPA before filing.

No production secret belongs in this repository or in Supabase application data.
