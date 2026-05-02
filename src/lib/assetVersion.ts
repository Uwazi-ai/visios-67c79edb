/**
 * Bump this string whenever you ship updated images, icons, fonts, or other
 * static assets and want browsers / installed PWAs to pick them up immediately.
 *
 * Vite already content-hashes anything imported from `@/assets/*`, so those
 * cache-bust automatically on every build. This constant is for assets in
 * `/public` (manifest icons, apple-touch-icon, favicon, etc.) that are
 * referenced by URL and would otherwise be cached indefinitely.
 */
export const ASSET_VERSION = "20260502a";

/** Append `?v=ASSET_VERSION` to a URL, preserving any existing query string. */
export const withVersion = (url: string, version: string = ASSET_VERSION) =>
  url.includes("?") ? `${url}&v=${version}` : `${url}?v=${version}`;
