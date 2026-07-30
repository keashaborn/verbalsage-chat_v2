import type { ReactNode } from "react";

type PublicAuthShellProps = {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
};

type PublicAuthNoticeProps = {
  children: ReactNode;
  tone?: "error" | "success" | "neutral";
};

export const PUBLIC_AUTH_SECTION_CLASS = "mt-5 border-t border-border/70 pt-5";

export const PUBLIC_AUTH_PRIMARY_ACTION_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const PUBLIC_AUTH_SECONDARY_ACTION_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50";

export function PublicAuthShell({
  title,
  intro,
  children,
}: PublicAuthShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-start px-4 py-10 sm:py-16">
      <section className="w-full rounded-xl border bg-background p-5 shadow-sm sm:p-7">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          LifeSwitch
        </div>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        {intro ? (
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            {intro}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}

export function PublicAuthNotice({
  children,
  tone = "neutral",
}: PublicAuthNoticeProps) {
  const toneClass =
    tone === "error"
      ? "border-destructive/30 bg-destructive/10"
      : tone === "success"
        ? "border-emerald-600/30 bg-emerald-500/10"
        : "border-border/70 bg-muted/20";

  return (
    <div
      className={`rounded-lg border p-4 text-sm text-foreground ${toneClass}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
