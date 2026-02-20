/**
 * Client-side Canny Edge Detection for coloring page conversion.
 *
 * Pipeline: grayscale → Gaussian blur → Sobel → non-max suppression
 *         → double threshold → hysteresis → dilation → invert
 *
 * Processing is split into two phases:
 *   1. loadAndPrepare() — runs once per image (expensive)
 *   2. processWithSettings() — runs on every control change (fast)
 */

const MAX_PROCESSING_SIZE = 1500;

export interface ProcessingOptions {
  sensitivity: number; // 1–100
  thickness: number; // 1–5
}

export interface ProcessingCache {
  suppressed: Float32Array;
  width: number;
  height: number;
  originalUrl: string;
}

// ─── Public API ──────────────────────────────────────────────

export async function loadAndPrepare(file: File): Promise<ProcessingCache> {
  const img = await loadImage(file);
  const { ctx, width, height } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Original preview
  const originalUrl = createCanvas(img).canvas.toDataURL("image/jpeg", 0.85);

  // Steps 1–4 (invariant to controls)
  const gray = toGrayscale(imageData.data, width * height);
  const blurred = gaussianBlur(gray, width, height, 1.4);
  const { magnitude, direction } = sobel(blurred, width, height);
  const suppressed = nonMaxSuppression(magnitude, direction, width, height);

  return { suppressed, width, height, originalUrl };
}

export function processWithSettings(
  cache: ProcessingCache,
  options: ProcessingOptions,
): string {
  const { suppressed, width, height } = cache;

  // Steps 5–8 (depend on controls)
  const { low, high } = computeThresholds(suppressed, options.sensitivity);
  const edges = hysteresis(suppressed, width, height, low, high);
  const dilated = dilate(edges, width, height, options.thickness);

  // Build output: black edges on white background
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(width, height);
  const size = width * height;

  for (let i = 0; i < size; i++) {
    const val = dilated[i] ? 0 : 255;
    const idx = i * 4;
    out.data[idx] = val;
    out.data[idx + 1] = val;
    out.data[idx + 2] = val;
    out.data[idx + 3] = 255;
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** High-quality PNG for download (called once, can be slower). */
export function getDownloadDataUrl(
  cache: ProcessingCache,
  options: ProcessingOptions,
): string {
  const { suppressed, width, height } = cache;
  const { low, high } = computeThresholds(suppressed, options.sensitivity);
  const edges = hysteresis(suppressed, width, height, low, high);
  const dilated = dilate(edges, width, height, options.thickness);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(width, height);
  const size = width * height;

  for (let i = 0; i < size; i++) {
    const val = dilated[i] ? 0 : 255;
    const idx = i * 4;
    out.data[idx] = val;
    out.data[idx + 1] = val;
    out.data[idx + 2] = val;
    out.data[idx + 3] = 255;
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL("image/png");
}

// ─── Image helpers ───────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function createCanvas(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  let { naturalWidth: w, naturalHeight: h } = img;

  const maxDim = Math.max(w, h);
  if (maxDim > MAX_PROCESSING_SIZE) {
    const scale = MAX_PROCESSING_SIZE / maxDim;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, width: w, height: h };
}

// ─── Step 1: Grayscale ──────────────────────────────────────

function toGrayscale(pixels: Uint8ClampedArray, size: number): Float32Array {
  const gray = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const idx = i * 4;
    gray[i] =
      0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
  return gray;
}

// ─── Step 2: Gaussian Blur (separable) ──────────────────────

function gaussianBlur(
  input: Float32Array,
  w: number,
  h: number,
  sigma: number,
): Float32Array {
  const radius = Math.ceil(sigma * 3);
  const kSize = radius * 2 + 1;
  const kernel = new Float32Array(kSize);
  let sum = 0;

  for (let i = 0; i < kSize; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < kSize; i++) kernel[i] /= sum;

  // Horizontal pass
  const temp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(w - 1, Math.max(0, x + k));
        val += input[y * w + sx] * kernel[k + radius];
      }
      temp[y * w + x] = val;
    }
  }

  // Vertical pass
  const output = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(h - 1, Math.max(0, y + k));
        val += temp[sy * w + x] * kernel[k + radius];
      }
      output[y * w + x] = val;
    }
  }

  return output;
}

// ─── Step 3: Sobel Operator ─────────────────────────────────

function sobel(
  input: Float32Array,
  w: number,
  h: number,
): { magnitude: Float32Array; direction: Float32Array } {
  const size = w * h;
  const magnitude = new Float32Array(size);
  const direction = new Float32Array(size);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = input[(y - 1) * w + (x - 1)];
      const t = input[(y - 1) * w + x];
      const tr = input[(y - 1) * w + (x + 1)];
      const l = input[y * w + (x - 1)];
      const r = input[y * w + (x + 1)];
      const bl = input[(y + 1) * w + (x - 1)];
      const b = input[(y + 1) * w + x];
      const br = input[(y + 1) * w + (x + 1)];

      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;

      const idx = y * w + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  return { magnitude, direction };
}

// ─── Step 4: Non-Maximum Suppression ────────────────────────

function nonMaxSuppression(
  mag: Float32Array,
  dir: Float32Array,
  w: number,
  h: number,
): Float32Array {
  const output = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const m = mag[idx];
      if (m === 0) continue;

      const deg = (((dir[idx] * 180) / Math.PI + 180) % 180);
      let n1: number, n2: number;

      if (deg < 22.5 || deg >= 157.5) {
        n1 = mag[y * w + (x - 1)];
        n2 = mag[y * w + (x + 1)];
      } else if (deg < 67.5) {
        n1 = mag[(y - 1) * w + (x + 1)];
        n2 = mag[(y + 1) * w + (x - 1)];
      } else if (deg < 112.5) {
        n1 = mag[(y - 1) * w + x];
        n2 = mag[(y + 1) * w + x];
      } else {
        n1 = mag[(y - 1) * w + (x - 1)];
        n2 = mag[(y + 1) * w + (x + 1)];
      }

      output[idx] = m >= n1 && m >= n2 ? m : 0;
    }
  }

  return output;
}

// ─── Step 5: Threshold Computation ──────────────────────────

function computeThresholds(
  mag: Float32Array,
  sensitivity: number,
): { low: number; high: number } {
  let maxMag = 0;
  let count = 0;

  for (let i = 0; i < mag.length; i++) {
    if (mag[i] > 0) {
      if (mag[i] > maxMag) maxMag = mag[i];
      count++;
    }
  }

  if (count === 0 || maxMag === 0) return { low: 0, high: 0 };

  // Histogram with 256 bins
  const bins = 256;
  const hist = new Uint32Array(bins);
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] > 0) {
      const bin = Math.min(bins - 1, Math.floor((mag[i] / maxMag) * (bins - 1)));
      hist[bin]++;
    }
  }

  // Higher sensitivity → lower percentile → lower threshold → more edges
  const percentile = 1 - (sensitivity / 100) * 0.9; // maps 1→0.991, 100→0.1
  const targetCount = Math.floor(percentile * count);
  let cumulative = 0;
  let highBin = bins - 1;

  for (let i = 0; i < bins; i++) {
    cumulative += hist[i];
    if (cumulative >= targetCount) {
      highBin = i;
      break;
    }
  }

  const high = (highBin / (bins - 1)) * maxMag;
  const low = high * 0.4;
  return { low, high };
}

// ─── Step 6: Hysteresis Edge Tracking ───────────────────────

function hysteresis(
  mag: Float32Array,
  w: number,
  h: number,
  low: number,
  high: number,
): Uint8Array {
  const size = w * h;
  const strong = 2;
  const weak = 1;
  const classified = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    if (mag[i] >= high) classified[i] = strong;
    else if (mag[i] >= low) classified[i] = weak;
  }

  // BFS from strong edges into connected weak edges
  const result = new Uint8Array(size);
  const queue: number[] = [];

  for (let i = 0; i < size; i++) {
    if (classified[i] === strong) {
      result[i] = 1;
      queue.push(i);
    }
  }

  let front = 0;
  while (front < queue.length) {
    const idx = queue[front++];
    const x = idx % w;
    const y = (idx - x) / w;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nIdx = ny * w + nx;
        if (classified[nIdx] === weak && result[nIdx] === 0) {
          result[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
  }

  return result;
}

// ─── Step 7: Morphological Dilation ─────────────────────────

function dilate(
  edges: Uint8Array,
  w: number,
  h: number,
  thickness: number,
): Uint8Array {
  if (thickness <= 1) return edges;

  let current = edges;
  const iterations = thickness - 1;

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (current[y * w + x]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                next[ny * w + nx] = 1;
              }
            }
          }
        }
      }
    }
    current = next;
  }

  return current;
}
