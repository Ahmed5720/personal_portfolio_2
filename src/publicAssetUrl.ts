/**
 * Build a URL for files in `public/` that respects Vite `base`
 * (required for GitHub Pages project sites).
 */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const normalized = path.replace(/^\//, '');
  return `${base}${normalized}`;
}
