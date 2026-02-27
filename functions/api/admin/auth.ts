/**
 * POST /api/admin/auth — Login with password
 * GET  /api/admin/auth — Check session
 */

interface Env {
  ADMIN_PASSWORD: string;
}

const COOKIE_NAME = "ourcoloring_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

async function createToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ":" + Date.now());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function setCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

function getCookie(request: Request): string | null {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

// Store valid tokens in memory (resets on Worker restart, which is fine)
const validTokens = new Set<string>();

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const { password } = await request.json() as { password: string };

    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await createToken(password);
    validTokens.add(token);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie(token),
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const token = getCookie(context.request);

  if (!token || !validTokens.has(token)) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Export auth check for other admin endpoints
export function isAuthenticated(request: Request): boolean {
  const token = getCookie(request);
  return !!token && validTokens.has(token);
}
