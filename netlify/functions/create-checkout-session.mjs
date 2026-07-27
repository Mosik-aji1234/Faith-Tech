import { handleApiRequest } from "../../server/shared.mjs";

export const handler = async (event) => {
  const result = await handleApiRequest({
    method: event.httpMethod || "POST",
    pathname: "/api/create-checkout-session",
    body: event.body || "",
    headers: event.headers || {},
    env: process.env,
    origin: getOrigin(event.headers || {}),
  });

  return formatResponse(result);
};

function getOrigin(headers) {
  const proto = headers["x-forwarded-proto"] || "https";
  return `${proto}://${headers.host}`;
}

function formatResponse(result) {
  return {
    statusCode: result.status,
    headers: result.headers,
    body: result.body,
  };
}
