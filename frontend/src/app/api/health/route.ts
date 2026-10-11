// Liveness probe for the load balancer / container orchestrator.
// Kept dependency-free and non-cached so it stays cheap and always current.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
