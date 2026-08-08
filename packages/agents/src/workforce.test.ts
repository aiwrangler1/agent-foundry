import { describe, expect, it } from "vitest";
import { evaluateWorkforceNeed } from "./index.js";

describe("governed workforce order", () => {
  it("stops at the first sufficient lower-cost capability", () => { const result = evaluateWorkforceNeed({ artifactAvailable: false, authoritativeDataAvailable: false, deterministicRuleAvailable: true, existingToolAvailable: true, existingWorkflowExtendable: true, existingAgentAvailable: true, externalServiceAvailable: true, ephemeralFit: true, persistentFit: true }); expect(result).toHaveLength(3); expect(result[2]?.step).toBe("deterministic_rule"); });
  it("escalates when no governed capability is sufficient", () => { const result = evaluateWorkforceNeed({ artifactAvailable: false, authoritativeDataAvailable: false, deterministicRuleAvailable: false, existingToolAvailable: false, existingWorkflowExtendable: false, existingAgentAvailable: false, externalServiceAvailable: false, ephemeralFit: false, persistentFit: false }); expect(result.at(-1)?.outcome).toBe("escalate"); });
});
