import type { ReactNode } from "react";

type AppTopBarProps = {
  children: ReactNode;
  className?: string;
};

export const APP_TOP_BAR_CLASS =
  "sticky top-0 z-50 shrink-0 border-b border-border/45 bg-background/95 shadow-xs supports-[backdrop-filter]:bg-background/70 supports-[backdrop-filter]:backdrop-blur-2xl";

export function AppTopBar({ children, className = "" }: AppTopBarProps) {
  return (
    <header
      data-app-top-bar
      className={`${APP_TOP_BAR_CLASS} ${className}`.trim()}
    >
      {children}
    </header>
  );
}
