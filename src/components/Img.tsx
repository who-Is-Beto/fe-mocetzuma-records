import { useState, type ImgHTMLAttributes } from "react";
import type { CoverThumbs } from "../app/domain/album";
import { isThirdPartyImage, useConsent } from "../app/lib/consent";
import { imageSrc } from "../app/lib/image";

type ImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "width" | "height" | "loading" | "fetchPriority"
> & {
  src: string;
  alt: string;
  /** Largest CSS width it renders at (px). Picks the thumbnail and reserves layout. */
  width: number;
  /** Intrinsic aspect with `width`; defaults to square (record covers). */
  height?: number;
  /** `sizes` attribute; defaults to the fixed `width`. Set it for fluid images. */
  sizes?: string;
  /** WebP thumbnails of `src` from the API (record covers); {} or absent = use `src`. */
  thumbs?: CoverThumbs;
  /** Above the fold (LCP): eager + high fetch priority. Otherwise lazy. */
  priority?: boolean;
  /** Gradient shown while loading; off for logos / print. */
  placeholder?: boolean;
};

/**
 * The app's image component: width/height reserve space (no layout shift),
 * lazy by default, priority for above-the-fold, gradient placeholder while
 * loading. With `thumbs` it serves a WebP srcset from our storage and falls
 * back to the original if a thumbnail fails.
 */
export function Img({
  src,
  alt,
  width,
  height = width,
  sizes,
  thumbs,
  priority = false,
  placeholder = true,
  className = "",
  onError,
  ...rest
}: ImgProps) {
  const [fallback, setFallback] = useState(false);
  const consent = useConsent();
  const candidates = fallback
    ? []
    : Object.entries(thumbs ?? {})
        .map(([w, url]) => [Number(w), url] as const)
        .sort((a, b) => a[0] - b[0]);
  const useThumbs = candidates.length > 0;
  // Default src: the smallest thumbnail that covers 2x (retina), else the largest.
  // Known third-party hosts (Discogs…) come through our domain: no cookies of theirs.
  const original = imageSrc(src);
  const thumbSrc = useThumbs
    ? (candidates.find(([w]) => w >= width * 2) ?? candidates[candidates.length - 1])[1]
    : original;

  // Rejected cookies: an image still on a host we don't proxy (a handful of
  // one-off stores) could set its cookies, so it becomes the placeholder.
  if (consent === "rejected" && !useThumbs && isThirdPartyImage(original)) {
    return (
      <span
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        title="Imagen externa oculta por tu preferencia de cookies"
        style={{ aspectRatio: `${width} / ${height}` }}
        className={`flex items-center justify-center bg-gradient-to-br from-denim/10 via-cream to-sand/80 text-xl ${className}`}
      >
        <span aria-hidden="true">🎵</span>
      </span>
    );
  }

  return (
    <img
      {...rest}
      src={thumbSrc}
      srcSet={useThumbs ? candidates.map(([w, url]) => `${url} ${w}w`).join(", ") : undefined}
      sizes={useThumbs ? sizes ?? `${width}px` : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={
        placeholder ? `bg-gradient-to-br from-denim/10 via-cream to-sand/80 ${className}` : className
      }
      onError={(e) => {
        // A thumbnail failed: retry the original before telling the caller.
        if (useThumbs) setFallback(true);
        else onError?.(e);
      }}
    />
  );
}
