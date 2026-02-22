/**
 * Cloudflare Pages Function — POST /api/convert
 *
 * When XAI_API_KEY is set: calls Grok API to generate a coloring page.
 * When XAI_API_KEY is missing: returns { mock: true } so the client
 * falls back to client-side edge detection.
 */

interface Env {
  XAI_API_KEY?: string;
}

interface RequestBody {
  image: string; // base64 data URL
  mode: "keep" | "remove" | "create";
  difficulty: "high" | "medium" | "low";
}

// ── Prompt Assembly ──────────────────────────────────────────

const PROMPT_BASE = `이 사진을 아래의 조건을 지켜서 색칠도안으로 바꿔줘.
조건
1. 재생성된 색칠 도안은 색상 절대 없이, 반드시 흰 바탕에 검정 선만 있어야 해.
2. 색칠 도안으로 변경된 주인공은 사진과 최대한 비슷해야 해.
3. 피부색, 머리카락 색 등 모든 색상을 제거하고 윤곽선만 남겨줘
4. 주인공의 내부 선밀도를 50%로 낮춰줘.
5. 인형의 경우 봉제선을 없애줘.`;

const BG_PROMPTS: Record<string, string> = {
  keep: "6. 주변 배경도 그대로 색칠도안으로 바꿔줘.",
  remove: "6. 주변 배경은 제거해줘.",
  create:
    "6. 주변 배경은 기존 배경을 사용하지 않고, 주인공과 어울리게 꾸며줘.",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  high: "",
  medium:
    "7~9살 아이가 색칠할 수 있도록, 큰 윤곽선까지만 단조롭게 그려줘",
  low: "4~6살 아이가 색칠할 수 있도록 큰 윤곽선만 단순하게 그려줘",
};

function buildPrompt(mode: string, difficulty: string): string {
  let prompt = PROMPT_BASE + "\n" + (BG_PROMPTS[mode] || BG_PROMPTS.keep);

  const diff = DIFFICULTY_PROMPTS[difficulty] || "";
  if (diff) {
    prompt += "\n" + diff;
  }

  return prompt;
}

// ── Handler ──────────────────────────────────────────────────

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  // No API key → tell client to use mock
  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ mock: true }),
      { status: 200, headers: corsHeaders },
    );
  }

  try {
    const body: RequestBody = await request.json();
    const { image, mode = "keep", difficulty = "high" } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const prompt = buildPrompt(mode, difficulty);

    // Call x.ai Grok Image API
    // Uses chat completions with image input for photo-to-coloring transformation
    const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-2-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: image },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!grokRes.ok) {
      const errorText = await grokRes.text();
      console.error("Grok API error:", grokRes.status, errorText);
      return new Response(
        JSON.stringify({
          error: "AI conversion failed",
          status: grokRes.status,
        }),
        { status: 502, headers: corsHeaders },
      );
    }

    const grokData: any = await grokRes.json();

    // Extract generated image from response
    // Grok-2-image returns images as URLs in the message content
    const content = grokData.choices?.[0]?.message?.content;
    let imageUrl: string | null = null;

    if (typeof content === "string") {
      // Check if it contains an image URL
      const urlMatch = content.match(/https:\/\/[^\s"]+\.(png|jpg|jpeg|webp)/i);
      if (urlMatch) imageUrl = urlMatch[0];
    } else if (Array.isArray(content)) {
      // Content array format
      for (const item of content) {
        if (item.type === "image_url") {
          imageUrl = item.image_url?.url;
          break;
        }
      }
    }

    if (!imageUrl) {
      console.error("No image in Grok response:", JSON.stringify(grokData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No image in AI response" }),
        { status: 502, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ mock: false, imageUrl }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    console.error("Convert API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
};
