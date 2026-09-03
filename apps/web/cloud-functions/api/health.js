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

export async function onRequest({ request, env }) {
  const API_URL = env.API_URL;

  if (!API_URL || !URL.canParse(API_URL)) {
    return Response.json(
      { error: { code: "PROXY_NOT_CONFIGURED", message: "API proxy is not configured" } },
      { status: 500 },
    );
  }

  const target = new URL(API_URL);
  target.pathname = `${target.pathname.replace(/\/$/, "")}/health`;
  target.search = new URL(request.url).search;

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return Response.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Upstream API is unavailable" } },
      { status: 502 },
    );
  }
}
