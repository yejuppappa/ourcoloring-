/**
 * PATCH  /api/admin/drawings/:id — Update drawing metadata
 * DELETE /api/admin/drawings/:id — Delete drawing (+ R2 images)
 */

interface Env {
  DB: D1Database;
  GALLERY_BUCKET: R2Bucket;
  ADMIN_PASSWORD: string;
}

const headers = { "Content-Type": "application/json" };

export async function onRequestPatch(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { request, env, params } = context;

  try {
    const data = await request.json() as Record<string, any>;
    const allowed = [
      "name_ko", "name_en", "description_ko", "description_en",
      "difficulty", "age_min", "age_max", "is_published", "subcategory_id",
    ];

    const sets: string[] = [];
    const values: any[] = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (sets.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid fields to update" }),
        { status: 400, headers }
      );
    }

    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    await env.DB.prepare(
      `UPDATE drawings SET ${sets.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers }
    );
  }
}

export async function onRequestDelete(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const { env, params } = context;

  try {
    // Get drawing to find R2 keys
    const drawing = await env.DB.prepare(
      "SELECT image_key, thumbnail_key FROM drawings WHERE id = ?"
    )
      .bind(params.id)
      .first<{ image_key: string; thumbnail_key: string }>();

    if (!drawing) {
      return new Response(
        JSON.stringify({ error: "Drawing not found" }),
        { status: 404, headers }
      );
    }

    // Delete from R2
    await env.GALLERY_BUCKET.delete([drawing.image_key, drawing.thumbnail_key]);

    // Delete from D1
    await env.DB.prepare("DELETE FROM drawings WHERE id = ?")
      .bind(params.id)
      .run();

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers }
    );
  }
}
