import { useSeo } from "./useSeo";

/**
 * Legacy convenience wrapper kept for the many pages that only need a title.
 * New pages should prefer `useSeo` (title + description + robots).
 */
export function usePageTitle(title: string | null) {
  useSeo({ title });
}
