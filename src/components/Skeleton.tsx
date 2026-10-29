import type { ReactNode } from "react";

/**
 * Loading placeholders shaped like the content they stand in for, so the page
 * keeps its layout (no footer jump when data lands). The spinning-record
 * Loader stays for button / inline busy states.
 */

/** One shimmering block; size and shape come from `className`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-lg ${className}`} />;
}

/** Screen-reader announcement + wrapper every preset uses. */
function Loading({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A catalog Card: square cover, pills, title, artist, price row. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-navy/10 bg-cream/85 p-4 shadow-card">
      <Skeleton className="aspect-square w-full rounded-[18px]" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-12 rounded-pill" />
        <Skeleton className="h-5 w-8 rounded-pill" />
        <Skeleton className="ml-auto h-5 w-20 rounded-pill" />
      </div>
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-8 w-28 rounded-pill" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

/** The catalog grid (same columns as CatalogoPage). */
export function CardGridSkeleton({ count = 6, label = "Cargando discos…" }: { count?: number; label?: string }) {
  return (
    <Loading label={label} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </Loading>
  );
}

/** Record detail: cover left, buy box right (stacked on phones). */
export function RecordDetailSkeleton() {
  return (
    <Loading label="Cargando disco…" className="grid gap-8 lg:grid-cols-[minmax(0,600px),1fr]">
      <Skeleton className="aspect-square w-full rounded-[28px]" />
      <div className="space-y-4 lg:pt-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-20 rounded-pill" />
          <Skeleton className="h-9 w-20 rounded-pill" />
          <Skeleton className="h-9 w-20 rounded-pill" />
        </div>
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-12 w-full rounded-pill sm:w-64" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </Loading>
  );
}

/** Rows with a thumbnail: cart items, orders, admin lists. */
export function ListSkeleton({ rows = 4, label = "Cargando…" }: { rows?: number; label?: string }) {
  return (
    <Loading label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-navy/10 bg-cream/80 p-4 shadow-card">
          <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </Loading>
  );
}

/** Route-level fallback while a page's code loads: tall enough that the footer stays put. */
export function PageSkeleton() {
  return (
    <Loading label="Cargando página…" className="min-h-[75vh] space-y-6 pt-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-2/3 max-w-xl" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-64 w-full rounded-[28px]" />
    </Loading>
  );
}
