/**
 * POST /api/convert — Grok Image Edit API (photo → coloring page)
 */
import type { APIContext } from "astro";

export const prerender = false;

interface RequestBody {
  image: string;
  mode: "keep" | "remove" | "create";
  difficulty: "high" | "medium" | "low";
}

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
  if (diff) prompt += "\n" + diff;
  return prompt;
}

export async function POST(context: APIContext): Promise<Response> {
  const env = context.locals.runtime.env;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  const apiKey = env.XAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ mock: true }),
      { status: 200, headers: corsHeaders },
    );
  }

  try {
    const body: RequestBody = await context.request.json();
    const { image, mode = "keep", difficulty = "high" } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const prompt = buildPrompt(mode, difficulty);

    const requestBody = {
      model: "grok-imagine-image",
      prompt,
      n: 1,
      response_format: "b64_json",
      image: { url: image, type: "image_url" },
    };

    const grokRes = await fetch("https://api.x.ai/v1/images/edits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokRes.ok) {
      const errorText = await grokRes.text();
      console.error("Grok API error:", grokRes.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI conversion failed", status: grokRes.status }),
        { status: 502, headers: corsHeaders },
      );
    }

    const grokData: any = await grokRes.json();
    const b64 = grokData.data?.[0]?.b64_json;

    if (!b64) {
      console.error("No image in Grok response:", JSON.stringify(grokData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No image in AI response" }),
        { status: 502, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ mock: false, imageUrl: `data:image/png;base64,${b64}` }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    console.error("Convert API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
}
