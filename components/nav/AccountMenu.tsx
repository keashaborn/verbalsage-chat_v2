"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type AccountMenuProps = {
  label?: string;
};

function displayNameFromUser(user: any, fallback: string) {
  return (
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.email as string | undefined)?.trim() ||
    fallback
  );
}

export function AccountMenu({ label = "Account" }: AccountMenuProps) {
  const [displayName, setDisplayName] = React.useState("Signed in");
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;

        setDisplayName(displayNameFromUser(data.user, "Signed in"));
        setIsAdmin((data.user as any)?.app_metadata?.role === "admin");
      } catch {
        if (!alive) return;
        setDisplayName("Signed in");
        setIsAdmin(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer select-none rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 active:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {label} ▾
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-background shadow-lg">
        <div className="border-b px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Signed in as
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">
            {displayName}
          </div>
        </div>

        <nav className="py-1 text-sm">
          <AccountMenuLink href="/settings/assistant-profile">Assistant Profile</AccountMenuLink>
          <AccountMenuLink href="/settings/appearance">Appearance</AccountMenuLink>
          <AccountMenuLink href="/settings/models-voice">Models & Voice</AccountMenuLink>
          <div className="my-1 border-t" />
          <AccountMenuLink href="/settings/account">Account</AccountMenuLink>
          <AccountMenuLink href="/settings/security">Security</AccountMenuLink>
          {isAdmin ? <AccountMenuLink href="/admin">Admin Console</AccountMenuLink> : null}
          <div className="my-1 border-t" />
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            Sign out
          </button>
        </nav>
      </div>
    </details>
  );
}

function AccountMenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block px-3 py-2 hover:bg-muted/60">
      {children}
    </Link>
  );
}
