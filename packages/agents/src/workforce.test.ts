import { describe, expect, it } from "vitest";
import {
  createFilingResearchCapabilityManifest,
  createShadowCeoAgentManifest,
  createShadowTaxAgentManifest,
  createTaxResearchCapabilityManifest,
  evaluateWorkforceNeed,
  seedShadowCeoFilingResearchWorkforce,
  seedShadowTaxResearchWorkforce
} from "./index.js";

describe("governed workforce order", () => {
  it("stops at the first sufficient lower-cost capability", () => { const result = evaluateWorkforceNeed({ artifactAvailable: false, authoritativeDataAvailable: false, deterministicRuleAvailable: true, existingToolAvailable: true, existingWorkflowExtendable: true, existingAgentAvailable: true, externalServiceAvailable: true, ephemeralFit: true, persistentFit: true }); expect(result).toHaveLength(3); expect(result[2]?.step).toBe("deterministic_rule"); });
  it("escalates when no governed capability is sufficient", () => { const result = evaluateWorkforceNeed({ artifactAvailable: false, authoritativeDataAvailable: false, deterministicRuleAvailable: false, existingToolAvailable: false, existingWorkflowExtendable: false, existingAgentAvailable: false, externalServiceAvailable: false, ephemeralFit: false, persistentFit: false }); expect(result.at(-1)?.outcome).toBe("escalate"); });
});

describe("shadow ceo filing-research seed manifests", () => {
  const seedInput = {
    organizationId: "org-acme",
    businessUnitId: "bu-finance",
    createdBy: "human-founder",
    asOf: "2026-08-06T12:00:00.000Z",
    seedNamespace: "default"
  };

  it("creates a shadow ceo manifest with no production-write authority", () => {
    const agent = createShadowCeoAgentManifest(seedInput);
    expect(agent.id).toBe("agent:default:org-acme:bu-finance:shadow-ceo");
    expect(agent.role).toBe("ceo");
    expect(agent.status).toBe("shadow");
    expect(agent.authority).toBe("none");
    expect(agent.approvedTools).toEqual([
      "tool:authoritative-filing-retrieval.read",
      "tool:government-guidance-search.read",
      "tool:citation-formatter.read",
      "tool:draft-checklist-generator.read"
    ]);
    expect(agent.approvedData).toEqual(["public", "internal", "confidential"]);
    expect(agent.approvedModels).toEqual([
      "qualified-inexpensive-filing-research",
      "qualified-stronger-filing-research"
    ]);
  });

  it("creates a qualified filing-research capability with read-only citation scope", () => {
    const capability = createFilingResearchCapabilityManifest(seedInput);
    expect(capability.id).toBe("capability:default:org-acme:bu-finance:filing-research");
    expect(capability.kind).toBe("capability");
    expect(capability.qualified).toBe(true);
    expect(capability.businessUnitIds).toEqual(["bu-finance"]);
    expect(capability.metadata.outputMode).toContain("citation");
    expect(capability.metadata.dataAccessMode).toBe("read-only");
    expect(capability.metadata.writeAuthority).toBe("none");
    expect(capability.metadata.prohibitedActions).toContain("submit_filing");
  });

  it("seeds both manifests together with consistent identity scope", () => {
    const seed = seedShadowCeoFilingResearchWorkforce(seedInput);
    expect(seed.ceoAgent.organizationId).toBe(seed.filingResearchCapability.organizationId);
    expect(seed.ceoAgent.businessUnitId).toBe(seed.filingResearchCapability.businessUnitId);
    expect(seed.ceoAgent.policyVersion.createdBy).toBe("human-founder");
    expect(seed.filingResearchCapability.version.createdAt).toBe("2026-08-06T12:00:00.000Z");
  });
});

describe("shadow tax research seed manifests", () => {
  const seedInput = {
    organizationId: "org-acme",
    businessUnitId: "bu-finance",
    createdBy: "human-founder",
    asOf: "2026-08-06T12:00:00.000Z",
    seedNamespace: "default"
  };

  it("creates a shadow tax agent with authority none and read-only IRS/New York tax scope", () => {
    const agent = createShadowTaxAgentManifest(seedInput);
    expect(agent.id).toBe("agent:default:org-acme:bu-finance:shadow-tax-agent");
    expect(agent.role).toBe("tax");
    expect(agent.status).toBe("shadow");
    expect(agent.authority).toBe("none");
    expect(agent.approvedTools).toEqual([
      "tool:irs-guidance-retrieval.read",
      "tool:new-york-tax-guidance-retrieval.read",
      "tool:government-guidance-search.read",
      "tool:citation-formatter.read",
      "tool:tax-checklist-generator.read"
    ]);
    expect(agent.approvedModels).toEqual([
      "qualified-inexpensive-tax-research",
      "qualified-stronger-tax-research"
    ]);
  });

  it("creates a tax-research capability with citation-producing outputs and explicit prohibitions", () => {
    const capability = createTaxResearchCapabilityManifest(seedInput);
    expect(capability.id).toBe("capability:default:org-acme:bu-finance:tax-research");
    expect(capability.kind).toBe("capability");
    expect(capability.qualified).toBe(true);
    expect(capability.metadata.outputMode).toContain("citation");
    expect(capability.metadata.retrievalPolicy).toContain("irs");
    expect(capability.metadata.retrievalPolicy).toContain("new york");
    expect(capability.metadata.writeAuthority).toBe("none");
    expect(capability.metadata.dataAccessMode).toBe("read-only");
    expect(capability.metadata.prohibitedActions).toContain("register_tax_account");
    expect(capability.metadata.prohibitedActions).toContain("file_return");
    expect(capability.metadata.prohibitedActions).toContain("pay_tax");
    expect(capability.metadata.prohibitedActions).toContain("make_tax_election");
    expect(capability.metadata.prohibitedActions).toContain("change_permissions");
  });

  it("extends the filing seed shape without breaking existing callers", () => {
    const filingSeed = seedShadowCeoFilingResearchWorkforce(seedInput);
    expect(filingSeed.ceoAgent.id).toBe("agent:default:org-acme:bu-finance:shadow-ceo");
    expect(filingSeed.filingResearchCapability.id).toBe("capability:default:org-acme:bu-finance:filing-research");
    expect(filingSeed.taxAgent).toBeUndefined();
    expect(filingSeed.taxResearchCapability).toBeUndefined();
  });

  it("seeds both tax manifests together with consistent identity scope", () => {
    const seed = seedShadowTaxResearchWorkforce(seedInput);
    expect(seed.taxAgent.organizationId).toBe(seed.taxResearchCapability.organizationId);
    expect(seed.taxAgent.businessUnitId).toBe(seed.taxResearchCapability.businessUnitId);
    expect(seed.taxAgent.policyVersion.createdBy).toBe("human-founder");
    expect(seed.taxResearchCapability.version.createdAt).toBe("2026-08-06T12:00:00.000Z");
  });
});
