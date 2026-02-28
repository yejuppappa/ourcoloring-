/**
 * POST /api/admin/drawings — Create drawing (FormData: image + metadata)
 * GET  /api/admin/drawings — List drawings (admin view)
 */
import type { APIContext } from "astro";

export const prerender = false;

const headers = { "Content-Type": "application/json" };

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;

  try {
    const formData = await context.request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers },
      );
    }

    const subcategoryId = formData.get("subcategory_id") as string;
    const nameKo = (formData.get("name_ko") as string) || imageFile.name.replace(/\.[^.]+$/, "");
    const nameEn = (formData.get("name_en") as string) || nameKo;
    const difficulty = (formData.get("difficulty") as string) || "medium";
    const ageMin = parseInt(formData.get("age_min") as string) || 3;
    const ageMax = parseInt(formData.get("age_max") as string) || 10;
    const descriptionKo = (formData.get("description_ko") as string) || "";
    const descriptionEn = (formData.get("description_en") as string) || "";

    const id = generateId();
    const slug = slugify(nameEn || nameKo) + "-" + id.slice(0, 6);

    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
    const imageKey = `drawings/${subcategoryId}/${slug}.${ext}`;
    const thumbnailKey = `thumbnails/${subcategoryId}/${slug}.webp`;

    // Upload original image to R2
    const imageBuffer = await imageFile.arrayBuffer();
    await env.GALLERY_BUCKET.put(imageKey, imageBuffer, {
      httpMetadata: { contentType: imageFile.type },
    });

    // Use same image as thumbnail for now
    await env.GALLERY_BUCKET.put(thumbnailKey, imageBuffer, {
      httpMetadata: { contentType: imageFile.type },
    });

    // Insert into D1
    await env.DB.prepare(
      `INSERT INTO drawings (id, subcategory_id, slug, name_ko, name_en,
        description_ko, description_en, difficulty, age_min, age_max,
        image_key, thumbnail_key, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
      .bind(
        id, subcategoryId, slug, nameKo, nameEn,
        descriptionKo, descriptionEn, difficulty, ageMin, ageMax,
        imageKey, thumbnailKey,
      )
      .run();

    return new Response(
      JSON.stringify({ ok: true, id, slug }),
      { status: 201, headers },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers },
    );
  }
}

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);

  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;
  const search = url.searchParams.get("search") || "";
  const subcategory = url.searchParams.get("subcategory") || "";

  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (subcategory) {
      conditions.push("d.subcategory_id = ?");
      params.push(subcategory);
    }
    if (search) {
      conditions.push("(d.name_ko LIKE ? OR d.name_en LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

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
       ${where}
       ORDER BY d.created_at DESC
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
