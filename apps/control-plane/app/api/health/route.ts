export function GET() { return Response.json({ ok: true, productionWritesEnabled: process.env.PRODUCTION_WRITES_ENABLED === "true" }); }
