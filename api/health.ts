// A minimal Vercel runtime diagnostic; no imports, credentials, or user data.
export function GET(): Response {
  return Response.json(
    { ok: true, service: "thrive-planner-api" },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
