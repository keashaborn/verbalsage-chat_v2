export const SITE_HEADER = "x-vs-site";

export type SiteId = "lifeswitch" | "verbal-sage";

export type SiteBrand = Readonly<{
  id: SiteId;
  name: string;
  shortName: string;
  description: string;
  canonicalHostname: string;
  homeHref: string;
  settingsReturnHref: string;
  iconLight: string;
  iconDark: string;
  favicon: string;
  appleTouchIcon?: string;
  themeColor: string;
  backgroundColor: string;
  accentColor: string;
  accentStrongColor: string;
  attribution?: string;
  manifestIcons: ReadonlyArray<
    Readonly<{
      src: string;
      sizes: string;
      type: string;
      purpose: "any" | "maskable";
    }>
  >;
}>;

const SITE_BRANDS: Readonly<Record<SiteId, SiteBrand>> = {
  lifeswitch: {
    id: "lifeswitch",
    name: "LifeSwitch",
    shortName: "LifeSwitch",
    description:
      "LifeSwitch health, training, nutrition, and measurement tracking.",
    canonicalHostname: "lifeswitch.com",
    homeHref: "/",
    settingsReturnHref: "/lifeswitch",
    iconLight: "/brand/lifeswitch/symbol-dark-64.png",
    iconDark: "/brand/lifeswitch/symbol-light-64.png",
    favicon: "/brand/lifeswitch/favicon-favorite-v4.ico",
    appleTouchIcon: "/brand/lifeswitch/app-icon-favorite-180-v4.png",
    themeColor: "#111113",
    backgroundColor: "#111113",
    accentColor: "#30343b",
    accentStrongColor: "#111113",
    attribution: "powered by Verbal Sage",
    manifestIcons: [
      {
        src: "/brand/lifeswitch/app-icon-favorite-192-v4.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/lifeswitch/app-icon-favorite-512-v4.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/lifeswitch/app-icon-favorite-192-v4.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/lifeswitch/app-icon-favorite-512-v4.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
  "verbal-sage": {
    id: "verbal-sage",
    name: "Verbal Sage",
    shortName: "Verbal Sage",
    description:
      "Private AI conversations with voice, memory, and personalized guidance.",
    canonicalHostname: "verbalsage.com",
    homeHref: "/",
    settingsReturnHref: "/",
    iconLight: "/brand/vs-icon.svg",
    iconDark: "/brand/vs-icon.svg",
    favicon: "/brand/verbal-sage/favicon.ico",
    appleTouchIcon: "/brand/verbal-sage/app-icon-180.png",
    themeColor: "#832cea",
    backgroundColor: "#111113",
    accentColor: "#9e3dff",
    accentStrongColor: "#832cea",
    manifestIcons: [
      {
        src: "/brand/verbal-sage/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/verbal-sage/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/verbal-sage/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/verbal-sage/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
};

const PRODUCTION_HOSTS: Readonly<Record<string, SiteId>> = {
  "lifeswitch.com": "lifeswitch",
  "www.lifeswitch.com": "lifeswitch",
  "verbalsage.com": "verbal-sage",
  "www.verbalsage.com": "verbal-sage",
};

const LOCAL_HOSTS: Readonly<Record<string, SiteId>> = {
  localhost: "lifeswitch",
  "127.0.0.1": "lifeswitch",
  "::1": "lifeswitch",
  "lifeswitch.localhost": "lifeswitch",
  "verbalsage.localhost": "verbal-sage",
};

const LIFESWITCH_PAGE_PREFIXES = [
  "/lifeswitch",
  "/lifeswitch-v2",
  "/invite/lifeswitch",
  "/share/workout",
] as const;

const LIFESWITCH_API_PREFIXES = ["/api/lifeswitch"] as const;

export type SiteHostResolution = Readonly<{
  hostname: string;
  siteId: SiteId;
  canonicalHostname: string;
  recognized: boolean;
  local: boolean;
}>;

export type SiteRequestDisposition =
  | "allow"
  | "redirect-to-lifeswitch"
  | "not-found";

export function isSiteId(value: unknown): value is SiteId {
  return value === "lifeswitch" || value === "verbal-sage";
}

export function brandForSite(siteId: SiteId): SiteBrand {
  return SITE_BRANDS[siteId];
}

export function normalizeSiteHostname(raw: unknown): string {
  let value = String(raw || "")
    .trim()
    .toLowerCase();
  if (!value) return "";

  if (value.startsWith("[")) {
    const bracket = value.indexOf("]");
    if (bracket !== -1) value = value.slice(1, bracket);
  } else {
    const firstColon = value.indexOf(":");
    const lastColon = value.lastIndexOf(":");
    if (firstColon !== -1 && firstColon === lastColon) {
      value = value.slice(0, firstColon);
    }
  }

  return value.replace(/\.+$/, "");
}

export function resolveSiteHost(raw: unknown): SiteHostResolution {
  const hostname = normalizeSiteHostname(raw);
  const productionSite = PRODUCTION_HOSTS[hostname];
  if (productionSite) {
    return {
      hostname,
      siteId: productionSite,
      canonicalHostname: brandForSite(productionSite).canonicalHostname,
      recognized: true,
      local: false,
    };
  }

  const localSite = LOCAL_HOSTS[hostname];
  if (localSite) {
    return {
      hostname,
      siteId: localSite,
      canonicalHostname: hostname,
      recognized: true,
      local: true,
    };
  }

  return {
    hostname,
    siteId: "lifeswitch",
    canonicalHostname: "",
    recognized: false,
    local: false,
  };
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function classifySiteRequest(
  siteId: SiteId,
  pathname: string,
  method: string,
): SiteRequestDisposition {
  if (siteId === "lifeswitch") return "allow";

  if (
    LIFESWITCH_API_PREFIXES.some((prefix) =>
      matchesPathPrefix(pathname, prefix),
    )
  ) {
    return "not-found";
  }

  if (
    LIFESWITCH_PAGE_PREFIXES.some((prefix) =>
      matchesPathPrefix(pathname, prefix),
    )
  ) {
    return method === "GET" || method === "HEAD"
      ? "redirect-to-lifeswitch"
      : "not-found";
  }

  return "allow";
}
