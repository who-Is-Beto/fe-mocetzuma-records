/**
 * Third-party image hosts we serve through our own domain: the browser asks
 * /ext-img/<host>/<path> and Vercel (vercel.json rewrites; vite.config.ts in
 * dev) fetches it from the host. Their cookies are scoped to their domain, so
 * the browser drops them: these images load with or without cookie consent.
 *
 * Keep in sync with the /ext-img rewrites in vercel.json and vite.config.ts.
 * An explicit list on purpose: a generic proxy would serve anything for anyone.
 */
export const PROXIED_IMAGE_HOSTS = [
  "i.discogs.com",
  "i.ebayimg.com",
  "http2.mlstatic.com",
  "udiscover.mx",
  "i.scdn.co",
  "m.media-amazon.com",
  "is1-ssl.mzstatic.com",
] as const;

const PROXIED = new Set<string>(PROXIED_IMAGE_HOSTS);

/** https://i.discogs.com/a/b.jpeg → /ext-img/i.discogs.com/a/b.jpeg; anything else unchanged. */
export function imageSrc(src: string): string {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && PROXIED.has(url.hostname)
      ? `/ext-img/${url.hostname}${url.pathname}${url.search}`
      : src;
  } catch {
    return src; // relative / bundled asset
  }
}
