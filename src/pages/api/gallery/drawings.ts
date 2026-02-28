/**
 * GET /api/gallery/drawings — Public gallery API
 *
 * Query params:
 *   subcategory  — filter by subcategory_id
 *   category     — filter by category_id (all subcategories in that category)
 *   difficulty   — comma-separated: easy,medium,hard
 *   limit        — max 50 (default 24)
 *   offset       — pagination offset
 *   order        — newest (default) | popular | name
 *   locale       — ko | en (for name sorting)
 */
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60",
  };

  const subcategory = url.searchParams.get("subcategory") || "";
  const categoryId = url.searchParams.get("category") || "";
  const difficultyParam = url.searchParams.get("difficulty") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "24"), 50);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const orderParam = url.searchParams.get("order") || "newest";
  const locale = url.searchParams.get("locale") || "ko";

  try {
    const conditions: string[] = ["d.is_published = 1"];
    const params: any[] = [];

    if (subcategory) {
      conditions.push("d.subcategory_id = ?");
      params.push(subcategory);
    }

    if (categoryId) {
      conditions.push("s.category_id = ?");
      params.push(categoryId);
    }

    // Support comma-separated difficulties
    if (difficultyParam) {
      const diffs = difficultyParam.split(",").filter((d) => ["easy", "medium", "hard"].includes(d));
      if (diffs.length > 0 && diffs.length < 3) {
        conditions.push(`d.difficulty IN (${diffs.map(() => "?").join(",")})`);
        params.push(...diffs);
      }
    }

    const where = "WHERE " + conditions.join(" AND ");

    let orderBy: string;
    switch (orderParam) {
      case "popular":
        orderBy = "ORDER BY d.download_count DESC, d.created_at DESC";
        break;
      case "name":
        orderBy = locale === "en"
          ? "ORDER BY d.name_en ASC, d.created_at DESC"
          : "ORDER BY d.name_ko ASC, d.created_at DESC";
        break;
      default:
        orderBy = "ORDER BY d.created_at DESC";
    }

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM drawings d
       JOIN subcategories s ON d.subcategory_id = s.id
       ${where}`
    )
      .bind(...params)
      .first<{ count: number }>();

    const { results: drawings } = await env.DB.prepare(
      `SELECT d.*,
              c.slug as category_slug,
              c.name_ko as category_name_ko,
              c.name_en as category_name_en,
              s.slug as subcategory_slug,
              s.name_ko as subcategory_name_ko,
              s.name_en as subcategory_name_en
       FROM drawings d
       JOIN subcategories s ON d.subcategory_id = s.id
       JOIN categories c ON s.category_id = c.id
       ${where} ${orderBy}
       LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all();

    return new Response(
      JSON.stringify({ drawings, total: countResult?.count || 0 }),
      { headers },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers },
    );
  }
}
