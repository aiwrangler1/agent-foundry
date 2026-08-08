export interface ProviderHealth { provider: string; healthy: boolean; checkedAt: string; detail?: string; }
export interface SemrushPort { keywordResearch(query: string): Promise<{ apiUnits: number; rows: Array<Record<string, string>> }>; competitorResearch(domain: string): Promise<{ apiUnits: number; rows: Array<Record<string, string>> }>; }
export interface GitHubPort { createIssue(title: string, body: string): Promise<{ id: string; url: string }>; }
export interface NotificationPort { notifyHuman(subject: string, body: string): Promise<{ deliveryId: string }>; }

export const mockedSemrush: SemrushPort = {
  async keywordResearch(query) { return { apiUnits: 1, rows: [{ query, volume: "mocked", competition: "mocked" }] }; },
  async competitorResearch(domain) { return { apiUnits: 1, rows: [{ domain, competitors: "mocked" }] }; }
};
