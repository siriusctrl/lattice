const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteRoot = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://lattice-research.sirius-ctrl.chatgpt.site/"
).replace(/\/?$/, "/");

export function toSitePath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}

export function toAbsoluteSiteUrl(path: string) {
  return new URL(path.replace(/^\//, ""), siteRoot).toString();
}

export const essayPaths = {
  zh: "/notes/beyond-linear-chat",
  en: "/en/notes/beyond-linear-chat",
} as const;
