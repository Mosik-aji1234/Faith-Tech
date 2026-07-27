import { handleApiRequest } from "../server/shared.mjs";

export default async function handler(request, response) {
  const result = await handleApiRequest({
    method: request.method || "POST",
    pathname: "/api/verify-checkout-session",
    body: await readBody(request),
    headers: request.headers,
    env: process.env,
    origin: getOrigin(request),
  });

  sendResponse(response, result);
}

function getOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  return `${proto}://${request.headers.host}`;
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function sendResponse(response, result) {
  response.status(result.status);
  for (const [key, value] of Object.entries(result.headers || {})) {
    response.setHeader(key, value);
  }
  response.send(result.body);
}
