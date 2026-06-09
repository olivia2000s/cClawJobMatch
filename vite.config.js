import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In dev we mirror the production `/api/tasks` Vercel serverless function with a
// small middleware: it injects the agent X-API-Key (read from a server-side
// MCCLAW_API_KEY in .env, NOT a VITE_ var) and proxies the McClaw marketplace,
// so the key never reaches the browser bundle. The remaining `/api/v1` proxy is
// kept for any direct McClaw calls and never sees /api/tasks.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const KEY = env.MCCLAW_API_KEY || "";
  const BASE = env.MCCLAW_API_URL || "https://mcclaw.io/api/v1";

  const liveTasksDev = {
    name: "mcclaw-live-tasks-dev",
    configureServer(server) {
      server.middlewares.use("/api/tasks", async (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (!KEY) {
          res.end(JSON.stringify({ tasks: [] }));
          return;
        }
        try {
          const r = await fetch(`${BASE}/tasks/?status=new&page_size=50`, {
            headers: { Accept: "application/json", "X-API-Key": KEY },
          });
          res.statusCode = r.status;
          res.end(await r.text());
        } catch (e) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
        }
      });
      // Mirror /api/apply: verify a task is still open before handing off.
      server.middlewares.use("/api/apply", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        const id = new URL(req.url, "http://localhost").searchParams.get("id");
        if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: "missing id" })); return; }
        if (!KEY) { res.end(JSON.stringify({ available: false, reason: "no-key" })); return; }
        try {
          const r = await fetch(`${BASE}/tasks/${id}/`, { headers: { Accept: "application/json", "X-API-Key": KEY } });
          if (!r.ok) { res.end(JSON.stringify({ available: false, reason: "fetch-" + r.status })); return; }
          const t = await r.json();
          const status = String(t.status || "");
          res.end(JSON.stringify({ available: /new|funded/i.test(status), status, title: t.title }));
        } catch (e) {
          res.statusCode = 502;
          res.end(JSON.stringify({ available: false, error: String(e && e.message ? e.message : e) }));
        }
      });
    },
  };

  return {
    // GitHub Pages serves the app from /<repo>/, so prod assets need that base
    // path. Dev/preview stays at root. Override with VITE_BASE if the repo is
    // renamed or served from a custom domain (set VITE_BASE=/ for the latter).
    base: env.VITE_BASE || (mode === "production" ? "/cClawJobMatch/" : "/"),
    plugins: [react(), liveTasksDev],
    server: {
      proxy: {
        "/api/v1": { target: "https://mcclaw.io", changeOrigin: true, secure: true },
      },
    },
  };
});
