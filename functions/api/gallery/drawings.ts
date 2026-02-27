/**
 * GET /api/gallery/drawings — Public gallery API
 * Query params: subcategory, difficulty, limit, offset, order (newest|popular)
 */

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60",
  };

  const subcategory = url.searchParams.get("subcategory") || "";
  const difficulty = url.searchParams.get("difficulty") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const order = url.searchParams.get("order") === "popular" ? "popular" : "newest";

  try {
    const conditions: string[] = ["d.is_published = 1"];
    const params: any[] = [];

    if (subcategory) {
      conditions.push("d.subcategory_id = ?");
      params.push(subcategory);
    }
    if (difficulty) {
      conditions.push("d.difficulty = ?");
      params.push(difficulty);
    }

    const where = "WHERE " + conditions.join(" AND ");
    const orderBy =
      order === "popular"
        ? "ORDER BY d.download_count DESC, d.created_at DESC"
        : "ORDER BY d.created_at DESC";

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM drawings d ${where}`
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
      { headers }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers }
    );
  }
}
