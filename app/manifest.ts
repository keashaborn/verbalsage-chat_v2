import type { MetadataRoute } from "next";
import { brandForSite } from "@/lib/siteBrand";
import { requestSiteId } from "@/lib/siteBrandServer";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = brandForSite(await requestSiteId());
  return {
    name: brand.name,
    short_name: brand.shortName,
    start_url: "/",
    display: "standalone",
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    icons: brand.manifestIcons.map((icon) => ({ ...icon })),
  };
}
