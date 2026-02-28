/**
 * GET /api/admin/categories — List categories (with optional subcategories)
 */
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);
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
        { headers },
      );
    }

    return new Response(JSON.stringify({ categories }), { headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers },
    );
  }
}
