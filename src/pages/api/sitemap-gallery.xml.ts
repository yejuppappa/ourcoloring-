/**
 * GET /api/sitemap-gallery.xml — Dynamic sitemap for gallery pages
 */
import type { APIContext } from "astro";

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const baseUrl = "https://ourcoloring.com";

  try {
    const { results: drawings } = await env.DB.prepare(
      `SELECT d.slug as drawing_slug, d.updated_at,
              c.slug as category_slug,
              s.slug as subcategory_slug
       FROM drawings d
       JOIN subcategories s ON d.subcategory_id = s.id
       JOIN categories c ON s.category_id = c.id
       WHERE d.is_published = 1
       ORDER BY d.updated_at DESC`
    ).all<{
      drawing_slug: string;
      category_slug: string;
      subcategory_slug: string;
      updated_at: string;
    }>();

    const { results: categories } = await env.DB.prepare(
      "SELECT slug FROM categories ORDER BY sort_order"
    ).all<{ slug: string }>();

    const { results: subcategories } = await env.DB.prepare(
      `SELECT s.slug as subcategory_slug, c.slug as category_slug
       FROM subcategories s
       JOIN categories c ON s.category_id = c.id
       ORDER BY s.sort_order`
    ).all<{ subcategory_slug: string; category_slug: string }>();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    for (const locale of ["ko", "en"]) {
      xml += `
  <url>
    <loc>${baseUrl}/${locale}/gallery/</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

      for (const cat of categories) {
        xml += `
  <url>
    <loc>${baseUrl}/${locale}/gallery/${cat.slug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      for (const sub of subcategories) {
        xml += `
  <url>
    <loc>${baseUrl}/${locale}/gallery/${sub.category_slug}/${sub.subcategory_slug}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }

      for (const d of drawings) {
        xml += `
  <url>
    <loc>${baseUrl}/${locale}/gallery/${d.category_slug}/${d.subcategory_slug}/${d.drawing_slug}/</loc>
    <lastmod>${d.updated_at.split(" ")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
      }
    }

    xml += "\n</urlset>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: any) {
    return new Response(`<!-- Error: ${e.message} -->`, {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
}
