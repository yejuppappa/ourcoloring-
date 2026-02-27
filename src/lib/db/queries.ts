import type {
  Category,
  Subcategory,
  Drawing,
  DrawingWithMeta,
} from "./types";

type D1 = import("@cloudflare/workers-types").D1Database;

// ── Categories ──────────────────────────────────────────

export async function getCategories(db: D1): Promise<Category[]> {
  const { results } = await db
    .prepare("SELECT * FROM categories ORDER BY sort_order")
    .all<Category>();
  return results;
}

export async function getCategoryBySlug(
  db: D1,
  slug: string
): Promise<Category | null> {
  return db
    .prepare("SELECT * FROM categories WHERE slug = ?")
    .bind(slug)
    .first<Category>();
}

// ── Subcategories ───────────────────────────────────────

export async function getSubcategories(
  db: D1,
  categoryId: string
): Promise<Subcategory[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM subcategories WHERE category_id = ? ORDER BY sort_order"
    )
    .bind(categoryId)
    .all<Subcategory>();
  return results;
}

export async function getSubcategoryBySlug(
  db: D1,
  categoryId: string,
  slug: string
): Promise<Subcategory | null> {
  return db
    .prepare(
      "SELECT * FROM subcategories WHERE category_id = ? AND slug = ?"
    )
    .bind(categoryId, slug)
    .first<Subcategory>();
}

export async function getAllSubcategories(db: D1): Promise<Subcategory[]> {
  const { results } = await db
    .prepare("SELECT * FROM subcategories ORDER BY sort_order")
    .all<Subcategory>();
  return results;
}

// ── Drawings ────────────────────────────────────────────

export async function getDrawings(
  db: D1,
  opts: {
    subcategoryId?: string;
    difficulty?: string;
    isPublished?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: "newest" | "popular";
  } = {}
): Promise<{ drawings: Drawing[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.subcategoryId) {
    conditions.push("d.subcategory_id = ?");
    params.push(opts.subcategoryId);
  }
  if (opts.difficulty) {
    conditions.push("d.difficulty = ?");
    params.push(opts.difficulty);
  }
  if (opts.isPublished !== false) {
    conditions.push("d.is_published = 1");
  }

  const where = conditions.length
    ? "WHERE " + conditions.join(" AND ")
    : "";

  const order =
    opts.orderBy === "popular"
      ? "ORDER BY d.download_count DESC, d.created_at DESC"
      : "ORDER BY d.created_at DESC";

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM drawings d ${where}`)
    .bind(...params)
    .first<{ count: number }>();

  const { results } = await db
    .prepare(
      `SELECT d.* FROM drawings d ${where} ${order} LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<Drawing>();

  return { drawings: results, total: countResult?.count ?? 0 };
}

export async function getDrawingBySlug(
  db: D1,
  subcategoryId: string,
  slug: string
): Promise<Drawing | null> {
  return db
    .prepare(
      "SELECT * FROM drawings WHERE subcategory_id = ? AND slug = ?"
    )
    .bind(subcategoryId, slug)
    .first<Drawing>();
}

export async function getDrawingWithMeta(
  db: D1,
  drawingId: string
): Promise<DrawingWithMeta | null> {
  return db
    .prepare(
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
       WHERE d.id = ?`
    )
    .bind(drawingId)
    .first<DrawingWithMeta>();
}

export async function getPopularDrawings(
  db: D1,
  limit = 6
): Promise<DrawingWithMeta[]> {
  const { results } = await db
    .prepare(
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
       WHERE d.is_published = 1
       ORDER BY d.download_count DESC, d.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<DrawingWithMeta>();
  return results;
}

export async function getRelatedDrawings(
  db: D1,
  drawingId: string,
  subcategoryId: string,
  limit = 4
): Promise<Drawing[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM drawings
       WHERE subcategory_id = ? AND id != ? AND is_published = 1
       ORDER BY download_count DESC
       LIMIT ?`
    )
    .bind(subcategoryId, drawingId, limit)
    .all<Drawing>();
  return results;
}

export async function incrementDownloadCount(
  db: D1,
  drawingId: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE drawings SET download_count = download_count + 1 WHERE id = ?"
    )
    .bind(drawingId)
    .run();
}

// ── Admin CRUD ──────────────────────────────────────────

export async function createDrawing(
  db: D1,
  drawing: Omit<Drawing, "download_count" | "created_at" | "updated_at">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO drawings (id, subcategory_id, slug, name_ko, name_en,
        description_ko, description_en, difficulty, age_min, age_max,
        image_key, thumbnail_key, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      drawing.id,
      drawing.subcategory_id,
      drawing.slug,
      drawing.name_ko,
      drawing.name_en,
      drawing.description_ko,
      drawing.description_en,
      drawing.difficulty,
      drawing.age_min,
      drawing.age_max,
      drawing.image_key,
      drawing.thumbnail_key,
      drawing.is_published
    )
    .run();
}

export async function updateDrawing(
  db: D1,
  id: string,
  data: Partial<
    Pick<
      Drawing,
      | "name_ko"
      | "name_en"
      | "description_ko"
      | "description_en"
      | "difficulty"
      | "age_min"
      | "age_max"
      | "is_published"
      | "subcategory_id"
      | "slug"
    >
  >
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db
    .prepare(`UPDATE drawings SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...params)
    .run();
}

export async function deleteDrawing(db: D1, id: string): Promise<void> {
  await db.prepare("DELETE FROM drawings WHERE id = ?").bind(id).run();
}

export async function getDrawingsForAdmin(
  db: D1,
  opts: {
    search?: string;
    subcategoryId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ drawings: DrawingWithMeta[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.subcategoryId) {
    conditions.push("d.subcategory_id = ?");
    params.push(opts.subcategoryId);
  }
  if (opts.search) {
    conditions.push("(d.name_ko LIKE ? OR d.name_en LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }

  const where = conditions.length
    ? "WHERE " + conditions.join(" AND ")
    : "";

  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM drawings d ${where}`)
    .bind(...params)
    .first<{ count: number }>();

  const { results } = await db
    .prepare(
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
    .all<DrawingWithMeta>();

  return { drawings: results, total: countResult?.count ?? 0 };
}

// ── Category/Subcategory drawing counts ─────────────────

export async function getCategoriesWithCounts(
  db: D1
): Promise<(Category & { drawing_count: number })[]> {
  const { results } = await db
    .prepare(
      `SELECT c.*, COUNT(d.id) as drawing_count
       FROM categories c
       LEFT JOIN subcategories s ON c.id = s.category_id
       LEFT JOIN drawings d ON s.id = d.subcategory_id AND d.is_published = 1
       GROUP BY c.id
       ORDER BY c.sort_order`
    )
    .all<Category & { drawing_count: number }>();
  return results;
}

export async function getSubcategoriesWithCounts(
  db: D1,
  categoryId: string
): Promise<(Subcategory & { drawing_count: number })[]> {
  const { results } = await db
    .prepare(
      `SELECT s.*, COUNT(d.id) as drawing_count
       FROM subcategories s
       LEFT JOIN drawings d ON s.id = d.subcategory_id AND d.is_published = 1
       WHERE s.category_id = ?
       GROUP BY s.id
       ORDER BY s.sort_order`
    )
    .bind(categoryId)
    .all<Subcategory & { drawing_count: number }>();
  return results;
}
