/**
 * Empty means same-origin: a site served from CloudFront calls /api/* on its own origin.
 * Only a page opened on localhost or a bare IP needs an absolute backend URL.
 */
export const getApiUrl = () => {
  if (typeof window === "undefined") return "";
  const local =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
  return local ? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" : "";
};
