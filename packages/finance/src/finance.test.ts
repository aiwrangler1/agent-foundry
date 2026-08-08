import { describe, expect, it } from "vitest";
import { authorizeSpend, IdempotentLedger } from "./index.js";
import type { SpendAuthorization, SpendReservation } from "@agent-foundry/domain";

const reservation: SpendReservation = { organizationId: "org", businessUnitId: "bu", id: "res", budgetId: "budget", workflowId: "flow", amountMinor: 100, currency: "USD", status: "reserved" };
const authorization: SpendAuthorization = { organizationId: "org", businessUnitId: "bu", id: "auth", reservationId: "res", toolId: "tool", agentId: "agent", workflowId: "flow", costCenter: "cc", maxAmountMinor: 100, idempotencyKey: "idem", expiresAt: "2099-01-01T00:00:00.000Z" };

describe("financial controls", () => {
  it("rejects mismatched and expired authorization", () => { expect(authorizeSpend({ authorization, reservation, toolId: "other", agentId: "agent", workflowId: "flow", idempotencyKey: "idem", now: new Date("2026-01-01"), amountMinor: 1 }).reason).toBe("authorization_scope_mismatch"); expect(authorizeSpend({ authorization: { ...authorization, expiresAt: "2020-01-01T00:00:00.000Z" }, reservation, toolId: "tool", agentId: "agent", workflowId: "flow", idempotencyKey: "idem", now: new Date("2026-01-01"), amountMinor: 1 }).reason).toBe("authorization_expired"); });
  it("does not duplicate a journal entry on retry", () => { const ledger = new IdempotentLedger(); const first = ledger.post({ idempotencyKey: "idem", lines: [{ account: "expense", debitMinor: 10, creditMinor: 0 }, { account: "cash", debitMinor: 0, creditMinor: 10 }] }); expect(ledger.post({ ...first, lines: [{ account: "expense", debitMinor: 99, creditMinor: 0 }, { account: "cash", debitMinor: 0, creditMinor: 99 }] })).toBe(first); });
});
