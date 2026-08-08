# Financial controls

The finance package is an operational double-entry subledger. It is not the
company's legal accounting system. Every spend-capable call needs a reservation
and a short-lived authorization tied to the exact tool, workflow, agent,
cost-center, maximum action, and idempotency key.

Segregation of duties: the CRO proposes, CFO authorizes, the tool gateway
executes, the auditor reconciles, and the CEO handles strategic exceptions.
