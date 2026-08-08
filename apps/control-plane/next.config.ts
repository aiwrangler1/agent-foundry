import type { NextConfig } from "next";
const nextConfig: NextConfig = { transpilePackages: ["@agent-foundry/db", "@agent-foundry/domain", "@agent-foundry/feedback", "@agent-foundry/integrations", "@agent-foundry/workflows"] };
export default nextConfig;
