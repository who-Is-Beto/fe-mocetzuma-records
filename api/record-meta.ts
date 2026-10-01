/**
 * Share previews for /records/:slug (Vercel Function; vercel.json rewrites
 * that route here). Link-preview crawlers (WhatsApp, Facebook, X, Slack…)
 * don't run JavaScript, so the SPA's useSeo tags never reach them. This serves
 * the same built index.html with per-record Open Graph / Twitter / canonical
 * tags injected server-side; browsers then boot the SPA as usual.
 *
 * Any failure (API down, maintenance 503, unknown slug) serves the untouched
 * index.html, so the page itself never breaks because of this.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const API_URL = (
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  "https://api.moctezumarecords.com"
).replace(/\/$/, "");

// Same allowlist as src/app/lib/image.ts / vercel.json images.remotePatterns.
const OPTIMIZED_HOSTS = new Set(["i.discogs.com", "pub-68b3bb8285924e24851b40086d6cc375.r2.dev"]);

type ApiRecord = {
  title: string;
  slug: string;
  artist?: { name: string } | null;
  category?: { name: string } | null;
  condition?: string;
  sell_price?: string;
  price?: string;
  stock?: number;
  cover_image_url?: string | null;
  images?: string[];
};

const CONDITION_LABELS: { [code: string]: string } = {
  M: "Mint", NM: "Near Mint", "NM-": "Near Mint -", "VG+": "Very Good +",
  VG: "Very Good", G: "Good", F: "Fair", P: "Poor",
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let indexHtmlCache: string | null = null;
async function loadIndexHtml(origin: string): Promise<string> {
  if (indexHtmlCache) return indexHtmlCache;
  try {
    // Bundled with the function via vercel.json `functions.includeFiles`.
    indexHtmlCache = await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
  } catch {
    indexHtmlCache = await (await fetch(`${origin}/index.html`)).text();
  }
  return indexHtmlCache;
}

async function fetchRecord(slug: string): Promise<ApiRecord | null> {
  try {
    const res = await fetch(`${API_URL}/records/${encodeURIComponent(slug)}/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? ((await res.json()) as ApiRecord) : null;
  } catch {
    return null;
  }
}

export function shareImage(record: ApiRecord, origin: string): string {
  const src = record.cover_image_url || record.images?.[0] || "";
  if (!src) return `${origin}/moctelogo.png`;
  try {
    // 1200px via the image optimizer: the size preview cards want, served
    // from our domain (no hotlink surprises).
    if (OPTIMIZED_HOSTS.has(new URL(src).hostname)) {
      return `${origin}/_vercel/image?url=${encodeURIComponent(src)}&w=1200&q=75`;
    }
  } catch {
    return `${origin}/moctelogo.png`;
  }
  return src;
}

export function buildMetaTags(record: ApiRecord, origin: string): string {
  const artist = record.artist?.name;
  const title = artist ? `${record.title} — ${artist}` : record.title;
  const price = Number(record.sell_price ?? record.price);
  const details = [
    record.category?.name,
    record.condition ? CONDITION_LABELS[record.condition] ?? record.condition : null,
    Number.isFinite(price) && price > 0
      ? price.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
      : null,
  ].filter(Boolean).join(" · ");
  const availability = (record.stock ?? 0) > 0 ? "Disponible" : "Agotado";
  const description = `${details ? `${details}. ` : ""}${availability} en Moctezuma Records, tienda de vinilos en la CDMX. Envíos a todo México.`;
  const url = `${origin}/records/${encodeURIComponent(record.slug)}`;
  const image = shareImage(record, origin);
  const t = escapeHtml(`${title} | Moctezuma Records`);
  const d = escapeHtml(description);
  const i = escapeHtml(image);
  const u = escapeHtml(url);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`Portada de ${title}`)}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join("\n    ");
}

/** Drop the generic tags the per-record ones replace, then inject before </head>. */
export function injectMeta(html: string, tags: string): string {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:(?:type|title|description|image|image:alt|url)"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:(?:card|title|description|image)"[^>]*>/gi, "");
  return stripped.replace("</head>", `    ${tags}\n  </head>`);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const slug = url.searchParams.get("slug") ?? "";
  const html = await loadIndexHtml(origin);
  const record = slug ? await fetchRecord(slug) : null;

  return new Response(record ? injectMeta(html, buildMetaTags(record, origin)) : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Edge-cache per record briefly: price/stock changes show up within minutes.
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
