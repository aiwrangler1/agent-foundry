import type { SpendAuthorization, SpendReservation } from "@agent-foundry/domain";

export interface LedgerLine { account: string; debitMinor: number; creditMinor: number; }
export interface JournalEntry { idempotencyKey: string; lines: LedgerLine[]; }

export function authorizeSpend(input: { authorization: SpendAuthorization; reservation: SpendReservation; toolId: string; agentId: string; workflowId: string; idempotencyKey: string; now: Date; amountMinor: number }): { allowed: boolean; reason: string } {
  const { authorization: a, reservation: r } = input;
  if (a.expiresAt <= input.now.toISOString()) return { allowed: false, reason: "authorization_expired" };
  if (a.reservationId !== r.id || a.toolId !== input.toolId || a.agentId !== input.agentId || a.workflowId !== input.workflowId) return { allowed: false, reason: "authorization_scope_mismatch" };
  if (a.idempotencyKey !== input.idempotencyKey) return { allowed: false, reason: "idempotency_mismatch" };
  if (r.status !== "reserved") return { allowed: false, reason: "reservation_not_available" };
  if (input.amountMinor > a.maxAmountMinor || input.amountMinor > r.amountMinor) return { allowed: false, reason: "amount_exceeds_authority" };
  return { allowed: true, reason: "spend_authorized" };
}

export class IdempotentLedger {
  private readonly entries = new Map<string, JournalEntry>();
  post(entry: JournalEntry): JournalEntry {
    const existing = this.entries.get(entry.idempotencyKey);
    if (existing) return existing;
    const debit = entry.lines.reduce((sum, line) => sum + line.debitMinor, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.creditMinor, 0);
    if (debit !== credit) throw new Error("unbalanced_journal_entry");
    this.entries.set(entry.idempotencyKey, entry);
    return entry;
  }
}
