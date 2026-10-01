/**
 * Vercel Image Optimization (the non-Next.js `/_vercel/image` endpoint):
 * resizes, re-encodes to AVIF/WebP and caches remote covers at the edge.
 *
 * Keep IMAGE_WIDTHS and OPTIMIZED_HOSTS in sync with `images.sizes` and
 * `images.remotePatterns` in vercel.json — Vercel rejects anything else.
 */
export const IMAGE_WIDTHS = [64, 128, 256, 384, 640, 828, 1080, 1200] as const;

const OPTIMIZED_HOSTS = new Set([
  "i.discogs.com",
  "pub-68b3bb8285924e24851b40086d6cc375.r2.dev",
]);

const QUALITY = 75;

/** Only production builds run on Vercel; dev/preview serve images as-is. */
export const canOptimize = (src: string): boolean => {
  if (!import.meta.env.PROD) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZED_HOSTS.has(url.hostname);
  } catch {
    return false; // relative/bundled asset
  }
};

export const optimizedUrl = (src: string, width: number): string =>
  `/_vercel/image?url=${encodeURIComponent(src)}&w=${width}&q=${QUALITY}`;

/** srcset covering 1x–2x of the rendered width (retina) from the allowed widths. */
export const buildSrcSet = (src: string, renderWidth: number): string => {
  const max = renderWidth * 2;
  const widths = IMAGE_WIDTHS.filter((w) => w <= max);
  // Always offer at least one candidate that covers 2x.
  const cover = IMAGE_WIDTHS.find((w) => w >= max);
  if (cover && !widths.includes(cover)) widths.push(cover);
  return widths.map((w) => `${optimizedUrl(src, w)} ${w}w`).join(", ");
};
