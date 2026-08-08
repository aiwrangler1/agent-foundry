# Rollback and recovery

Rollback is a versioned deployment change, not a destructive database reset.
Pause affected workflows with a scoped kill switch, revoke integration
credentials when compromise is suspected, deploy the last known-good app
version, and reconcile tool calls, reservations, commitments, and journal
entries using idempotency keys. Database migrations must have a reviewed
forward-compatible follow-up migration; production data is restored from a
verified backup rather than deleted in place.
