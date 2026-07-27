import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleApiRequest } from "./shared.mjs";

async function loadEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch {
    // No env file present in this environment.
  }
}

const projectRoot = path.resolve(process.cwd());
await loadEnvFile(path.join(projectRoot, ".env"));
await loadEnvFile(path.join(projectRoot, ".env.local"));

const port = Number(process.env.API_PORT || 8787);

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  const corsHeaders = {
    "Access-Control-Allow-Origin": request.headers.origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  };

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (!requestUrl.pathname.startsWith("/api/")) {
    response.writeHead(404, corsHeaders);
    response.end("Not found");
    return;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  const result = await handleApiRequest({
    method: request.method || "GET",
    pathname: requestUrl.pathname,
    body,
    headers: request.headers,
    env: process.env,
    origin: request.headers.origin || `http://127.0.0.1:${port}`,
  });

  response.writeHead(result.status, {
    ...corsHeaders,
    ...result.headers,
  });
  response.end(result.body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Faith Tech API running on http://127.0.0.1:${port}`);
});
