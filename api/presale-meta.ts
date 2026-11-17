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
  purchase_deadline?: string;
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

async function fetchPresales(): Promise<ApiPresale[]> {
  try {
    const res = await fetch(`${API_URL}/presales/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    // Same as the page: only the ones still before their deadline (store day, CDMX).
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    return ((await res.json()) as ApiPresale[]).filter((p) => !p.purchase_deadline || p.purchase_deadline >= today);
  } catch {
    return [];
  }
}

/** /preventas: the list page's preview, naming the first presales and showing the first cover. */
export function buildListTags(presales: ApiPresale[], origin: string): string {
  const names = presales.slice(0, 3).map((p) => `${p.title} (${p.artist})`).join(", ");
  const t = escapeHtml("Preventas de vinilos | Moctezuma Records");
  const d = escapeHtml(
    presales.length
      ? `${presales.length} ${presales.length === 1 ? "preventa abierta" : "preventas abiertas"}: ${names}. Aparta con un anticipo y liquida en 120 días.`
      : "Preventas de vinilos en Moctezuma Records: aparta con un anticipo y liquida en 120 días."
  );
  const i = escapeHtml(presales.find((p) => p.cover)?.cover || `${origin}/moctelogo.png`);
  const u = escapeHtml(`${origin}/preventas`);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
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
  let tags: string | null = null;
  if (url.searchParams.get("list") === "1") {
    tags = buildListTags(await fetchPresales(), url.origin);
  } else if (slug) {
    const presale = await fetchPresale(slug);
    tags = presale ? buildPresaleTags(presale, url.origin) : null;
  }

  return new Response(tags ? injectMeta(html, tags) : html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
