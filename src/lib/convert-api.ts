export type BackgroundMode = "keep" | "remove" | "create";
export type Difficulty = "high" | "medium" | "low";

/**
 * Convert a photo to a coloring page via /api/convert (Cloudflare Function → Grok API).
 * Returns a data URL of the coloring page image.
 */
export async function convertImage(
  file: File,
  mode: BackgroundMode,
  difficulty: Difficulty,
): Promise<string> {
  const base64 = await fileToBase64(file, 1536);

  const res = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mode, difficulty }),
  });

  if (!res.ok) {
    throw new Error(`Conversion failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.mock || !data.imageUrl) {
    throw new Error("API key not configured");
  }

  return data.imageUrl;
}

/**
 * Create a preview URL for the uploaded file.
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Resize image and convert to base64 data URL.
 */
function fileToBase64(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { naturalWidth: w, naturalHeight: h } = img;

      const maxDim = Math.max(w, h);
      if (maxDim > maxSize) {
        const scale = maxSize / maxDim;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}
