import {
  loadAndPrepare,
  processWithSettings,
} from "./edge-detection";

export type BackgroundMode = "keep" | "remove" | "create";
export type Difficulty = "high" | "medium" | "low";

/**
 * Convert a photo to a coloring page.
 *
 * 1. Tries /api/convert (Cloudflare Function → Grok API).
 * 2. If the endpoint returns { mock: true } or is unreachable,
 *    falls back to client-side edge detection.
 *
 * Returns a data URL of the coloring page image.
 */
export async function convertImage(
  file: File,
  _mode: BackgroundMode,
  _difficulty: Difficulty,
): Promise<string> {
  // Try server-side API first
  try {
    const base64 = await fileToBase64(file, 1536);

    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64,
        mode: _mode,
        difficulty: _difficulty,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (!data.mock && data.imageUrl) {
        return data.imageUrl;
      }
    }
  } catch {
    // API not available — fall through to mock
  }

  // Mock fallback: client-side edge detection
  const cache = await loadAndPrepare(file);
  return processWithSettings(cache, { sensitivity: 50, thickness: 2 });
}

/**
 * Create a preview URL for the uploaded file (for the options screen).
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
