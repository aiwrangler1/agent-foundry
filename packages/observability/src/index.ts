export interface TraceContext { traceId: string; spanId: string; workflowId: string; agentId?: string; }
export function redactSecret(value: string): string { return value.length === 0 ? value : "[REDACTED]"; }
