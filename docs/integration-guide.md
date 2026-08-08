# Integration guide

Provider credentials are references, not raw secrets, and live outside the
domain database. Every integration must declare owner, account/install,
authentication method, scopes, environment, tools, action classes, rate and
usage limits, unit costs, health, and revocation state.

The first adapters are mocks for GitHub, Slack notifications, Semrush,
Supabase storage, a model gateway, publishing, ecommerce, advertising, and
accounting. A real adapter must be introduced behind the same port, with
contract tests and a policy review. Production writes remain locked until a
human explicitly enables the environment and the tool's action class.

For Codex/GitHub, authorize only the new control-plane repository and the
minimum required permissions. For Vercel and Supabase, keep team/project IDs
in local environment configuration and never commit service-role keys.
