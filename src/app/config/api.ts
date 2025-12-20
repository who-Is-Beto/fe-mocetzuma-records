export const API_BASE_URL =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : "http://localhost:8008";
