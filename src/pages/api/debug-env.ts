/**
 * GET /api/debug-env — Diagnose runtime bindings (TEMPORARY — delete after debugging)
 */
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const runtime = context.locals.runtime;
  const env = runtime?.env;

  const info: Record<string, any> = {
    hasRuntime: !!runtime,
    runtimeKeys: runtime ? Object.keys(runtime) : [],
    hasEnv: !!env,
    envKeys: env ? Object.keys(env) : [],
  };

  if (env) {
    info.DB_type = typeof env.DB;
    info.DB_constructor = env.DB?.constructor?.name || "none";
    info.DB_hasPrepare = typeof env.DB?.prepare;
    info.GALLERY_BUCKET_type = typeof env.GALLERY_BUCKET;
    info.GALLERY_BUCKET_constructor = env.GALLERY_BUCKET?.constructor?.name || "none";
    info.ADMIN_PASSWORD_defined = !!env.ADMIN_PASSWORD;
    info.XAI_API_KEY_defined = !!env.XAI_API_KEY;
    info.SITE_URL = env.SITE_URL || "not set";
  }

  // Also check if bindings are directly on locals (some adapter versions)
  const locals = context.locals as any;
  info.localsKeys = Object.keys(locals);
  if (locals.DB) {
    info.locals_DB_type = typeof locals.DB;
    info.locals_DB_constructor = locals.DB?.constructor?.name || "none";
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
