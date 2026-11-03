/** Empty string keeps requests on this origin, where Vite proxies `/api` to the local API. */
export const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";
