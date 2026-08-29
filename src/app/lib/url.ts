/** URL helpers shared across pages. */
export const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());