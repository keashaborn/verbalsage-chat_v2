"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppTopBar } from "@/components/nav/AppTopBar";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { WorkspaceMenu } from "@/components/nav/WorkspaceMenu";
import { useSiteBrand } from "@/components/site/SiteBrandProvider";

type SettingsPageFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsPageFrame({
  title,
  description,
  children,
}: SettingsPageFrameProps) {
  const { brand } = useSiteBrand();
  const router = useRouter();

  function goBack() {
    try {
      const saved = window.sessionStorage.getItem("vs_settings_return_to");
      if (saved && saved.startsWith("/")) {
        router.push(saved);
        return;
      }
    } catch {
      // ignore
    }

    router.push(brand.settingsReturnHref);
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppTopBar>
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <WorkspaceMenu label={brand.name} align="left" variant="plain" />
          <AccountMenu />
        </div>
      </AppTopBar>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={goBack}
            className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
