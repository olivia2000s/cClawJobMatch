// Vercel serverless function: GET /api/tasks
// Injects the agent X-API-Key (server-side env, never exposed to the browser)
// and proxies the McClaw marketplace feed. Set MCCLAW_API_KEY in your Vercel
// project's Environment Variables (NOT prefixed with VITE_).
export default async function handler(req, res) {
  const key = process.env.MCCLAW_API_KEY;
  const base = process.env.MCCLAW_API_URL || "https://mcclaw.io/api/v1";

  // No key configured → return empty so the client falls back to sample tasks.
  if (!key) return res.status(200).json({ tasks: [] });

  try {
    const r = await fetch(`${base}/tasks/?status=new&page_size=50`, {
      headers: { Accept: "application/json", "X-API-Key": key },
    });
    const body = await r.text();
    res.setHeader("Content-Type", "application/json");
    // Cache at the edge briefly so we don't hammer McClaw on every page load.
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
