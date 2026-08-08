# Architecture

The control plane is organized as a pnpm monorepo. The application layer owns
HTTP/UI composition; packages own domain contracts and invariants; integrations
are replaceable adapters.

```text
CEO / human operator
        |
control panel + API
        |
durable workflow ports ---- human request / approval ports
        |
policy engine ---- finance authorization ---- governed tool gateway
        |                         |
domain contracts          append-only audit + subledger
        |
Supabase adapter / mock adapter
```

The execution ladder is explicit: cache, authoritative retrieval,
deterministic rule, script/database query, API/tool, deterministic workflow,
least-cost qualified model, stronger qualified model, human escalation.

The compiler and context modules are versioned records. Stable modules precede
dynamic task context in the compiled prompt. Raw conversation history is not a
memory store.
