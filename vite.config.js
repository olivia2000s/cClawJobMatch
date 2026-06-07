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
    },
  };

  return {
    plugins: [react(), liveTasksDev],
    server: {
      proxy: {
        "/api/v1": { target: "https://mcclaw.io", changeOrigin: true, secure: true },
      },
    },
  };
});
