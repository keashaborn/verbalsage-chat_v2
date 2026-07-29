export const SERVER_OWNED_SAGE_HELPER_ROUTES = [
  "/lifeswitch/training/calendar",
  "/lifeswitch/training",
  "/lifeswitch/training/log",
] as const;

function normalizePathname(raw: string): string {
  const pathname = String(raw || "").split(/[?#]/, 1)[0] || "";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isServerOwnedSageHelperRoute(rawPathname: string): boolean {
  const pathname = normalizePathname(rawPathname);
  return SERVER_OWNED_SAGE_HELPER_ROUTES.some((route) => route === pathname);
}
