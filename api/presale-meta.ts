/**
 * Share previews for /preventas/:slug, same approach as record-meta.ts:
 * link-preview crawlers get the built index.html with this presale's
 * Open Graph / Twitter tags. Any failure serves the untouched page.
 */
import { API_URL, escapeHtml, injectMeta, loadIndexHtml } from "./record-meta.js";

type ApiPresale = {
  slug: string;
  title: string;
  artist: string;
  cover: string | null;
  price_from: string | null;
  estimated_arrival?: string;
  options: { min_deposit: string }[];
};

const mxn = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

async function fetchPresale(slug: string): Promise<ApiPresale | null> {
  try {
    const res = await fetch(`${API_URL}/presales/${encodeURIComponent(slug)}/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? ((await res.json()) as ApiPresale) : null;
  } catch {
    return null;
  }
}

export function buildPresaleTags(presale: ApiPresale, origin: string): string {
  const deposits = presale.options.map((o) => Number(o.min_deposit)).filter((n) => n > 0);
  const price = Number(presale.price_from);
  const facts = [
    deposits.length ? `Apártalo con ${mxn(Math.min(...deposits))}` : null,
    price > 0 ? `precio ${mxn(price)}` : null,
    presale.estimated_arrival ? `llega ${presale.estimated_arrival}` : null,
  ].filter(Boolean).join(" · ");
  const t = escapeHtml(`Preventa: ${presale.title} — ${presale.artist} | Moctezuma Records`);
  const d = escapeHtml(`${facts ? `${facts}. ` : ""}Preventa en Moctezuma Records, tienda de vinilos en la CDMX.`);
  const i = escapeHtml(presale.cover || `${origin}/moctelogo.png`);
  const u = escapeHtml(`${origin}/preventas/${encodeURIComponent(presale.slug)}`);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`Portada de ${presale.title}`)}" />`,
    `<meta property="og:url" content="${u}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join("\n    ");
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const html = await loadIndexHtml(url.origin);
  const presale = slug ? await fetchPresale(slug) : null;

  return new Response(presale ? injectMeta(html, buildPresaleTags(presale, url.origin)) : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
