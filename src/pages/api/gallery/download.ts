/**
 * POST /api/gallery/download — Increment download count
 */
import type { APIContext } from "astro";

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;
  const headers = { "Content-Type": "application/json" };

  try {
    const { id } = (await context.request.json()) as { id: string };

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing id" }),
        { status: 400, headers },
      );
    }

    await env.DB.prepare(
      "UPDATE drawings SET download_count = download_count + 1 WHERE id = ?"
    )
      .bind(id)
      .run();

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers },
    );
  }
}
