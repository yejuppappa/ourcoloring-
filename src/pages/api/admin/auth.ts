/**
 * POST /api/admin/auth — Login with password
 * GET  /api/admin/auth — Check session
 */
import type { APIContext } from "astro";
import { validTokens, getCookie } from "@/lib/admin-auth";

export const prerender = false;

const COOKIE_NAME = "ourcoloring_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

async function createToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ":" + Date.now());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function setCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;

  try {
    const { password } = (await context.request.json()) as { password: string };

    const inputPw = (password || "").trim();
    const storedPw = (env.ADMIN_PASSWORD || "").trim();

    // Debug: log to Cloudflare Workers logs (not exposed to client)
    console.log("[auth] ADMIN_PASSWORD defined:", !!env.ADMIN_PASSWORD);
    console.log("[auth] ADMIN_PASSWORD length:", storedPw.length);
    console.log("[auth] input length:", inputPw.length);
    console.log("[auth] match:", inputPw === storedPw);

    if (!storedPw || inputPw !== storedPw) {
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

export async function GET(context: APIContext): Promise<Response> {
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
