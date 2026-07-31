"use client";

import { createContext, useContext, type ReactNode } from "react";
import { brandForSite, type SiteBrand, type SiteId } from "@/lib/siteBrand";

type SiteBrandContextValue = Readonly<{
  siteId: SiteId;
  brand: SiteBrand;
}>;

const SiteBrandContext = createContext<SiteBrandContextValue>({
  siteId: "lifeswitch",
  brand: brandForSite("lifeswitch"),
});

export function SiteBrandProvider({
  siteId,
  children,
}: {
  siteId: SiteId;
  children: ReactNode;
}) {
  return (
    <SiteBrandContext.Provider value={{ siteId, brand: brandForSite(siteId) }}>
      {children}
    </SiteBrandContext.Provider>
  );
}

export function useSiteBrand(): SiteBrandContextValue {
  return useContext(SiteBrandContext);
}
