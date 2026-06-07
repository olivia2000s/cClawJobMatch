// Vercel serverless function: GET /api/apply?id=<taskId>
// We can't submit an application here — on McClaw, applying is authenticated as
// the *human applicant* (wallet/SIWE) and involves an on-chain $MCLAW stake the
// user must sign themselves. What we CAN do is verify, server-side with the
// agent key, that the task is still open before handing the user off to McClaw.
export default async function handler(req, res) {
  const key = process.env.MCCLAW_API_KEY;
  const base = process.env.MCCLAW_API_URL || "https://mcclaw.io/api/v1";
  const id = req.query && req.query.id;
  if (!id) return res.status(400).json({ error: "missing id" });
  if (!key) return res.status(200).json({ available: false, reason: "no-key" });
  try {
    const r = await fetch(`${base}/tasks/${id}/`, {
      headers: { Accept: "application/json", "X-API-Key": key },
    });
    if (!r.ok) return res.status(200).json({ available: false, reason: "fetch-" + r.status });
    const t = await r.json();
    const status = String(t.status || "");
    return res.status(200).json({ available: /new|funded/i.test(status), status, title: t.title });
  } catch (e) {
    return res.status(502).json({ available: false, error: String(e && e.message ? e.message : e) });
  }
}
