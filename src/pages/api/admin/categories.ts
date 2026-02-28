/**
 * /api/admin/categories — Category & Subcategory CRUD
 *
 * GET    ?subcategories          → list all (optionally with subcategories)
 * POST   { type, ...fields }     → create category or subcategory
 * PATCH  { type, id, ...fields } → update category or subcategory
 * DELETE { type, id }            → delete category or subcategory
 */
import type { APIContext } from "astro";
import { isAuthenticated, unauthorized } from "@/lib/admin-auth";

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ── GET ──
export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);
  const includeSubcategories = url.searchParams.has("subcategories");

  try {
    const { results: categories } = await env.DB.prepare(
      "SELECT * FROM categories ORDER BY sort_order"
    ).all();

    if (includeSubcategories) {
      const { results: subcategories } = await env.DB.prepare(
        "SELECT * FROM subcategories ORDER BY sort_order"
      ).all();
      return json({ categories, subcategories });
    }

    return json({ categories });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// ── POST (create) ──
export async function POST(context: APIContext): Promise<Response> {
  if (!isAuthenticated(context.request)) return unauthorized();
  const env = context.locals.runtime.env;

  try {
    const body = await context.request.json();
    const { type } = body;

    if (type === "category") {
      const { id, slug, name_ko, name_en, description_ko, description_en, icon, sort_order } = body;
      if (!id || !slug || !name_ko || !name_en) {
        return json({ error: "id, slug, name_ko, name_en 필수" }, 400);
      }
      await env.DB.prepare(
        `INSERT INTO categories (id, slug, name_ko, name_en, description_ko, description_en, icon, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(id, slug, name_ko, name_en, description_ko || "", description_en || "", icon || "", sort_order ?? 0)
        .run();
      return json({ ok: true });
    }

    if (type === "subcategory") {
      const { id, category_id, slug, name_ko, name_en, description_ko, description_en, sort_order } = body;
      if (!id || !category_id || !slug || !name_ko || !name_en) {
        return json({ error: "id, category_id, slug, name_ko, name_en 필수" }, 400);
      }
      await env.DB.prepare(
        `INSERT INTO subcategories (id, category_id, slug, name_ko, name_en, description_ko, description_en, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(id, category_id, slug, name_ko, name_en, description_ko || "", description_en || "", sort_order ?? 0)
        .run();
      return json({ ok: true });
    }

    return json({ error: "type must be 'category' or 'subcategory'" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// ── PATCH (update) ──
export async function PATCH(context: APIContext): Promise<Response> {
  if (!isAuthenticated(context.request)) return unauthorized();
  const env = context.locals.runtime.env;

  try {
    const body = await context.request.json();
    const { type, id } = body;
    if (!id) return json({ error: "id 필수" }, 400);

    if (type === "category") {
      const { slug, name_ko, name_en, description_ko, description_en, icon, sort_order } = body;
      await env.DB.prepare(
        `UPDATE categories SET slug=?, name_ko=?, name_en=?, description_ko=?, description_en=?, icon=?, sort_order=?
         WHERE id=?`
      )
        .bind(slug, name_ko, name_en, description_ko || "", description_en || "", icon || "", sort_order ?? 0, id)
        .run();
      return json({ ok: true });
    }

    if (type === "subcategory") {
      const { category_id, slug, name_ko, name_en, description_ko, description_en, sort_order } = body;
      await env.DB.prepare(
        `UPDATE subcategories SET category_id=?, slug=?, name_ko=?, name_en=?, description_ko=?, description_en=?, sort_order=?
         WHERE id=?`
      )
        .bind(category_id, slug, name_ko, name_en, description_ko || "", description_en || "", sort_order ?? 0, id)
        .run();
      return json({ ok: true });
    }

    return json({ error: "type must be 'category' or 'subcategory'" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// ── DELETE ──
export async function DELETE(context: APIContext): Promise<Response> {
  if (!isAuthenticated(context.request)) return unauthorized();
  const env = context.locals.runtime.env;

  try {
    const body = await context.request.json();
    const { type, id } = body;
    if (!id) return json({ error: "id 필수" }, 400);

    if (type === "category") {
      // Delete subcategories first (cascade)
      await env.DB.prepare("DELETE FROM subcategories WHERE category_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    if (type === "subcategory") {
      await env.DB.prepare("DELETE FROM subcategories WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return json({ error: "type must be 'category' or 'subcategory'" }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
