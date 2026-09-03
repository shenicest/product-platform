const HOP_BY_HOP_HEADERS = new Set([
  "connection", "content-length", "host", "keep-alive",
  "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "transfer-encoding", "upgrade",
]);

function forwardHeaders(headers) {
  const result = new Headers();
  for (const [name, value] of headers) {
    const lowerName = name.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerName) && lowerName !== "accept-encoding") {
      result.set(name, value);
    }
  }
  return result;
}

export async function onRequest({ request, env }) {
  const API_URL = env.API_URL;
  if (!API_URL || !URL.canParse(API_URL)) {
    return Response.json(
      { error: { code: "PROXY_NOT_CONFIGURED", message: "API proxy is not configured" } },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);
  const target = new URL(API_URL);
  target.pathname = `${target.pathname.replace(/\/$/, "")}${requestUrl.pathname}`;
  target.search = requestUrl.search;
  const method = request.method.toUpperCase();
  const init = { method, headers: forwardHeaders(request.headers), redirect: "manual" };
  if (method !== "GET" && method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const response = await fetch(target, init);
    const responseHeaders = new Headers(response.headers);
    for (const name of HOP_BY_HOP_HEADERS) responseHeaders.delete(name);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API proxy request failed", error);
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Upstream API is unavailable" } },
      { status: 502 },
    );
  }
}
