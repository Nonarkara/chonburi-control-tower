// Resolves the API origin for the dashboard's data feeds.
// - In dev, Vite proxies /api → http://localhost:8787 (see vite.config.ts),
//   so the default empty base ("") works against same-origin /api/* paths.
// - In production, set VITE_API_BASE to the deployed worker origin
//   (e.g. https://chonburi-api.workers.dev) at build time.

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";
