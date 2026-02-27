type R2Bucket = import("@cloudflare/workers-types").R2Bucket;

const R2_PUBLIC_URL = "https://images.ourcoloring.com";

export function getImageUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export function getThumbnailUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function uploadImage(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<void> {
  await bucket.put(key, data, {
    httpMetadata: { contentType },
  });
}

export async function deleteImage(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

export async function deleteImages(
  bucket: R2Bucket,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  await bucket.delete(keys);
}

/** Generate a unique key for an image: drawings/{subcatId}/{slug}.{ext} */
export function makeImageKey(
  subcategoryId: string,
  slug: string,
  ext: string
): string {
  return `drawings/${subcategoryId}/${slug}.${ext}`;
}

/** Generate a unique key for a thumbnail: thumbnails/{subcatId}/{slug}.webp */
export function makeThumbnailKey(
  subcategoryId: string,
  slug: string
): string {
  return `thumbnails/${subcategoryId}/${slug}.webp`;
}
