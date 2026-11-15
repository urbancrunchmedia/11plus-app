// Runs the real Vercel functions in api/ on a local port for end-to-end tests.
// /api/<path> -> api/<path>.js, with a JSON body parser and Vercel-style res.
// GET /__outbox returns emails captured in EMAIL_DRY_RUN mode.
import http from "http";
import path from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";

const ROOT = path.resolve(import.meta.dirname, "..");
const REWRITES = { "/api/portal": "/api/status" };

export function startApiServer(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__outbox") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(globalThis.__emailOutbox || []));
    }
    const route = REWRITES[url.pathname] || url.pathname;
    const file = path.join(ROOT, `${route}.js`);
    if (!route.startsWith("/api/") || !existsSync(file)) { res.statusCode = 404; return res.end("{}"); }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    req.query = Object.fromEntries(url.searchParams);
    res.status = (s) => { res.statusCode = s; return res; };
    res.json = (d) => { if (!res.headersSent) res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(d)); return res; };
    res.send = (d) => { res.end(typeof d === "string" ? d : JSON.stringify(d)); return res; };
    try {
      const { default: handler } = await import(pathToFileURL(file).href);
      await handler(req, res);
    } catch (e) {
      console.error(`[api] ${route}:`, e.message);
      if (!res.writableEnded) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
