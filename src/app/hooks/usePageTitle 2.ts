import { useEffect } from "react";

const SITE_NAME = "Moctezuma Records";

/**
 * Sets `document.title` on mount and cleans up on unmount.
 * Pass `null` to keep the base site name only.
 */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
