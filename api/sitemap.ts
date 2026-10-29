/**
 * /sitemap.xml (Vercel Function; vercel.json rewrites it here): the public
 * pages plus every record in the catalog, read from the API 100 at a time.
 * If the API fails midway the sitemap still lists what it got, so search
 * engines never receive an error for it.
 */
const API_URL = (
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  "https://api.moctezumarecords.com"
).replace(/\/$/, "");

const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/catalogo", priority: "0.9", changefreq: "daily" },
  { path: "/bazares", priority: "0.6", changefreq: "weekly" },
  { path: "/ayuda", priority: "0.3", changefreq: "monthly" },
  { path: "/contacto", priority: "0.3", changefreq: "monthly" },
  { path: "/terminos-y-condiciones", priority: "0.1", changefreq: "yearly" },
  { path: "/politica-de-privacidad", priority: "0.1", changefreq: "yearly" },
];

// Generous for ~600 records at 100 per page; stops runaway pagination.
const MAX_PAGES = 30;

type RecordPage = { next: string | null; results: { slug: string }[] };

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function recordSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(`${API_URL}/records/?page=${page}&page_size=100`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) break;
      const data = (await res.json()) as RecordPage;
      slugs.push(...data.results.map((r) => r.slug).filter(Boolean));
      if (!data.next) break;
    } catch {
      break;
    }
  }
  return slugs;
}

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const urls = [
    ...STATIC_PATHS.map(
      ({ path, priority, changefreq }) =>
        `<url><loc>${origin}${path}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
    ),
    ...(await recordSlugs()).map(
      (slug) =>
        `<url><loc>${escapeXml(`${origin}/records/${encodeURIComponent(slug)}`)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // New records show up within the hour; serve stale while refreshing.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
