/**
 * Shared auth check for admin API endpoints.
 * Validates the admin session cookie.
 */

const COOKIE_NAME = "ourcoloring_admin";

// Shared token store (module-level, persists across requests within same isolate)
export const validTokens = new Set<string>();

export function isAuthenticated(request: Request): boolean {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match ? match[1] : null;
  return !!token && validTokens.has(token);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
