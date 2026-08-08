# Internal harness OODA loop

This is a separate roadmap and review cycle inside the company loop.

```text
Company loop
└── Harness loop
    ├── Observe: run outcomes, cost, latency, approvals, incidents, provider changes
    ├── Orient: capability gaps, experimental status, risk, and alternatives
    ├── Decide: keep, constrain, qualify, replace, or retire a harness/provider
    ├── Act: sandbox/shadow change with deterministic gateway boundaries
    └── Review: compare metrics, rollback if needed, and start the next cycle
```

Initial harness roadmap:

1. Keep Codex and OpenCode behind the common `HarnessAgent` interface.
2. Expose only read-only context/tools to harnesses; route risky actions as
   proposals to the deterministic gateway.
3. Run new adapters in sandbox or shadow status with minimum data and no
   production-write authority.
4. Measure completion rate, failed work, cost, latency, human attention,
   approval friction, and policy violations.
5. Review weekly or after a material incident/provider change.
6. Promote, constrain, rollback, replace, or retire based on recorded review
   evidence.
