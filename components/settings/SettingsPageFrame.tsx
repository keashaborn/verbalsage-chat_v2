import type { ReactNode } from "react";
import Link from "next/link";

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

          <Link
            href="/lifeswitch"
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
          >
            Back to LifeSwitch
          </Link>
        </div>

        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
