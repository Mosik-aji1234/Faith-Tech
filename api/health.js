import { handleApiRequest } from "../server/shared.mjs";

export default async function handler(request, response) {
  const result = await handleApiRequest({
    method: request.method || "GET",
    pathname: "/api/health",
    body: "",
    headers: request.headers,
    env: process.env,
    origin: `https://${request.headers.host}`,
  });

  response.status(result.status);
  for (const [key, value] of Object.entries(result.headers || {})) {
    response.setHeader(key, value);
  }
  response.send(result.body);
}
