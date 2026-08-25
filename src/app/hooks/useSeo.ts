import { useEffect } from "react";

const SITE_NAME = "Moctezuma Records";

type SeoOptions = {
  /** Page title; combined with the site name. Pass null for the bare site name. */
  title?: string | null;
  /** Meta description for this page. Omit to keep the document default. */
  description?: string;
  /**
   * Exclude the page from search results (private pages: carrito, órdenes,
   * perfil, inventario, auth). Sets robots to noindex,nofollow.
   */
  noindex?: boolean;
};

type ManagedValue = { element: Element; previous: string | null };

/** Set (or create) an attribute on a tag selector, returning its old value. */
const applyTag = (
  selector: string,
  createTag: () => Element,
  attribute: string,
  value: string
): ManagedValue | null => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = createTag();
    document.head.appendChild(element);
  }
  const previous = element.getAttribute(attribute);
  if (previous === value) return null;
  element.setAttribute(attribute, value);
  return { element, previous };
};

/**
 * Per-page SEO metadata for the SPA: document title plus description,
 * robots, canonical URL and Open Graph/Twitter tags.
 *
 * All values are restored on unmount so client-side navigation between
 * pages never leaks one page's metadata into the next.
 */
export function useSeo({ title, description, noindex }: SeoOptions) {
  useEffect(() => {
    const undo: Array<() => void> = [];
    const remember = (managed: ManagedValue | null) => {
      if (!managed) return;
      const { element, previous } = managed;
      undo.push(() => {
        if (previous === null) element.removeAttribute(attribute_of(element));
        else element.setAttribute(attribute_of(element), previous);
      });
    };

    // Title
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const prevTitle = document.title;
    if (document.title !== fullTitle) document.title = fullTitle;
    undo.push(() => {
      document.title = prevTitle;
    });

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:5173";
    const pageUrl = `${origin}${window.location.pathname}`;
    const content = description ?? undefined;

    const setMeta = (
      selector: string,
      attributeName: string,
      attributeValue: string,
      value: string
    ) => {
      remember(
        applyTag(
          selector,
          () => {
            const meta = document.createElement("meta");
            meta.setAttribute(attributeName, attributeValue);
            return meta;
          },
          "content",
          value
        )
      );
    };

    if (content) {
      setMeta('meta[name="description"]', "name", "description", content);
      setMeta('meta[property="og:description"]', "property", "og:description", content);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", content);
    }

    if (title) {
      setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
      setMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    }

    setMeta(
      'meta[property="og:url"]',
      "property",
      "og:url",
      pageUrl
    );
    setMeta(
      'meta[property="og:type"]',
      "property",
      "og:type",
      "website"
    );

    remember(
      applyTag(
        'link[rel="canonical"]',
        () => {
          const link = document.createElement("link");
          link.setAttribute("rel", "canonical");
          return link;
        },
        "href",
        pageUrl
      )
    );
    setMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow"
    );

    return () => {
      while (undo.length) undo.pop()?.();
    };
  }, [title, description, noindex]);
}

/** The attribute this hook manages on a given element ('content' or 'href'). */
function attribute_of(element: Element): string {
  return element.tagName === "LINK" ? "href" : "content";
}
