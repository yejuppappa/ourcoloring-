/**
 * GET /api/admin/categories — List categories (with optional subcategories)
 */

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { env, request } = context;
  const url = new URL(request.url);
  const includeSubcategories = url.searchParams.has("subcategories");

  const headers = { "Content-Type": "application/json" };

  try {
    const { results: categories } = await env.DB.prepare(
      "SELECT * FROM categories ORDER BY sort_order"
    ).all();

    if (includeSubcategories) {
      const { results: subcategories } = await env.DB.prepare(
        "SELECT * FROM subcategories ORDER BY sort_order"
      ).all();
      return new Response(
        JSON.stringify({ categories, subcategories }),
        { headers }
      );
    }

    return new Response(JSON.stringify({ categories }), { headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers }
    );
  }
}
