import { headers } from "next/headers";
import { isSiteId, SITE_HEADER, type SiteId } from "@/lib/siteBrand";

export async function requestSiteId(): Promise<SiteId> {
  const requestHeaders = await headers();
  const siteId = requestHeaders.get(SITE_HEADER);
  return isSiteId(siteId) ? siteId : "lifeswitch";
}
