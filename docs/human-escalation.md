# Human escalation model

Human requests are durable records, not chat messages. They contain the exact
requested action, requesting actor, workflow, business unit, evidence, cost,
risk, alternatives, recommended response, and continuation behavior.

The control plane may pause a workflow awaiting approval, information,
authentication, legal review, finance review, a human-only task, or incident
intervention. A response is accepted only from an actor with the required role;
the proposing agent cannot approve its own request. A resume operation carries
the approval/request-change/rejection decision and is idempotent against the
workflow run and request ID.
