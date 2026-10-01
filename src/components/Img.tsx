import { useState, type ImgHTMLAttributes } from "react";
import { buildSrcSet, canOptimize, optimizedUrl } from "../app/lib/image";

type ImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "width" | "height" | "loading" | "fetchPriority"
> & {
  src: string;
  alt: string;
  /** Largest CSS width it renders at (px). Picks srcset candidates and reserves layout. */
  width: number;
  /** Intrinsic aspect with `width`; defaults to square (record covers). */
  height?: number;
  /** `sizes` attribute; defaults to the fixed `width`. Set it for fluid images. */
  sizes?: string;
  /** Above the fold (LCP): eager + high fetch priority. Otherwise lazy. */
  priority?: boolean;
  /** Gradient shown while loading; off for logos / print. */
  placeholder?: boolean;
};

/**
 * The app's image component (the Vite counterpart of next/image):
 * width/height reserve space (no layout shift), lazy by default, priority for
 * above-the-fold, gradient placeholder while loading, and a Vercel-optimized
 * srcset for allowed hosts. If the optimizer fails it falls back to the original.
 */
export function Img({
  src,
  alt,
  width,
  height = width,
  sizes,
  priority = false,
  placeholder = true,
  className = "",
  onError,
  ...rest
}: ImgProps) {
  const [fallback, setFallback] = useState(false);
  const optimize = !fallback && canOptimize(src);

  return (
    <img
      {...rest}
      src={optimize ? optimizedUrl(src, width) : src}
      srcSet={optimize ? buildSrcSet(src, width) : undefined}
      sizes={optimize ? sizes ?? `${width}px` : undefined}
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
        // Optimizer failed: retry the original before telling the caller.
        if (optimize) setFallback(true);
        else onError?.(e);
      }}
    />
  );
}
