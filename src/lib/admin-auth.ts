/**
 * Shared admin auth — token store + cookie helpers.
 * Module-level state persists within the same Worker isolate.
 */

const COOKIE_NAME = "ourcoloring_admin";

// Valid tokens (resets on Worker restart, which is fine)
export const validTokens = new Set<string>();

export function getCookie(request: Request): string | null {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export function isAuthenticated(request: Request): boolean {
  const token = getCookie(request);
  return !!token && validTokens.has(token);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
