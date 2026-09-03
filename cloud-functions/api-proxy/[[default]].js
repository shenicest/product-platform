const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function forwardHeaders(headers) {
  const forwarded = new Headers();

  for (const [name, value] of headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== "accept-encoding") {
      forwarded.set(name, value);
    }
  }

  return forwarded;
}

function upstreamUrl(requestUrl, apiUrl) {
  const request = new URL(requestUrl);
  const proxyPrefix = "/api-proxy";
  const pathname = request.pathname.startsWith(proxyPrefix)
    ? request.pathname.slice(proxyPrefix.length) || "/"
    : "/";
  const target = new URL(apiUrl);
  const basePath = target.pathname.replace(/\/$/, "");

  target.pathname = `${basePath}${pathname}`;
  target.search = request.search;
  return target;
}

export async function onRequest({ request, env }) {
  // API_URL is configured in the EdgeOne Makers environment variables.
  const API_URL = env.API_URL;

  if (!API_URL || !URL.canParse(API_URL)) {
    return Response.json(
      { error: { code: "PROXY_NOT_CONFIGURED", message: "API proxy is not configured" } },
      { status: 500 },
    );
  }

  const method = request.method.toUpperCase();
  const init = {
    method,
    headers: forwardHeaders(request.headers),
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD" && request.body) {
    init.body = request.body;
    // Node's fetch requires this when forwarding a streaming request body.
    init.duplex = "half";
  }

  try {
    const response = await fetch(upstreamUrl(request.url, API_URL), init);
    const responseHeaders = new Headers(response.headers);

    for (const name of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(name);
    }

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
