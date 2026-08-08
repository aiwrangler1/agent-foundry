# ADR 0002: provider-neutral adapters

Status: accepted

Domain, policy, finance, and workflow packages do not import Vercel, Supabase,
GitHub, Slack, or model-provider SDKs. Integrations implement narrow ports and
return normalized records. Preview or beta APIs must be isolated in an adapter
with a fallback mock and an ADR before activation.
