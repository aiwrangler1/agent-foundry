# Human feedback loop

Human feedback is a governed input channel, not an implicit memory stream.
The control plane distinguishes a one-time correction from a durable preference
and requires an explicit human confirmation before durable context is created.

## Lifecycle

1. A human submits feedback with a statement, context, scope, provenance,
   category, target, and persistence intent.
2. The record enters `pending_confirmation`; it is not compiled into prompts.
3. A human confirms or rejects it.
4. Durable feedback becomes a versioned preference proposal with a key,
   rationale, audience, and review/expiration conditions.
5. A human activates the proposal. Replacing an active preference requires
   explicit supersession.
6. The Context Compiler includes only active, in-scope, unexpired preferences.

Policy, authority, approval, secret, and spend changes cannot be activated as
preferences. They remain `requires_policy_review` and require the separate
policy governance path. Every state transition has an append-only event.

The SQL schema is in `supabase/migrations/0002_human_feedback_loop.sql`. The
control-panel demo API is intentionally disabled unless
`CONTROL_PLANE_DEMO_MODE=true`; production writes must come from an
authenticated human adapter and a trusted server/workflow role.

## Operating convention

Unless a human explicitly says “remember this,” “make this a preference,” or
“make this company policy,” conversational guidance applies only to the current
task. Raw conversation history is never promoted to long-term memory.

The feedback system should record explanations that improve human onboarding,
including definitions of unfamiliar terms, while keeping those explanations
separate from policy and authority.
