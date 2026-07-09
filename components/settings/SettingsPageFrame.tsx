"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

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

    router.push("/lifeswitch");
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={goBack}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
          >
            Back
          </button>
        </div>

        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
