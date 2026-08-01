"use client";

import * as React from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import {
  ACCOUNT_IDENTITY_CHANGED_EVENT,
  normalizeAccountFullName,
} from "@/lib/accountIdentity";
import { productTierLabel } from "@/lib/productEntitlements";
import { supabase } from "@/lib/supabaseClient";

type AccountMenuProps = {
  label?: string;
};

function displayNameFromUser(user: any, fallback: string) {
  return (
    normalizeAccountFullName(user?.user_metadata?.full_name) ||
    (user?.email as string | undefined)?.trim() ||
    fallback
  );
}

function roleLabel(role: unknown) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Administrator";
  return "Member";
}

export function AccountMenu({ label = "Account" }: AccountMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [displayName, setDisplayName] = React.useState("Signed in");
  const [email, setEmail] = React.useState("");
  const [productTier, setProductTier] = React.useState<unknown>(null);
  const [role, setRole] = React.useState("");
  const [hasAdminAccess, setHasAdminAccess] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error || new Error("User unavailable");
        if (!alive) return;

        setDisplayName(displayNameFromUser(data.user, "Signed in"));
        setEmail((data.user.email as string | undefined)?.trim() || "");

        const [capabilitiesResult, adminResult] = await Promise.allSettled([
          authFetch("/api/auth/capabilities", {
            method: "GET",
            cache: "no-store",
          }),
          authFetch("/api/admin/access", {
            method: "GET",
            cache: "no-store",
          }),
        ]);
        if (!alive) return;

        if (capabilitiesResult.status === "fulfilled") {
          const capabilities = await capabilitiesResult.value
            .json()
            .catch(() => null);
          if (capabilities?.authenticated) {
            setProductTier(capabilities.product_tier);
            setRole(
              typeof capabilities.role === "string" ? capabilities.role : "",
            );
          }
        }
        setHasAdminAccess(
          adminResult.status === "fulfilled" && adminResult.value.ok,
        );
      } catch {
        if (!alive) return;
        setDisplayName("Signed in");
        setEmail("");
        setProductTier(null);
        setRole("");
        setHasAdminAccess(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    function onIdentityChanged(event: Event) {
      const detail = (
        event as CustomEvent<{ fullName?: unknown; email?: unknown }>
      ).detail;
      const nextName = normalizeAccountFullName(detail?.fullName);
      const nextEmail =
        typeof detail?.email === "string" ? detail.email.trim() : "";
      setDisplayName(nextName || nextEmail || "Signed in");
      if (nextEmail) setEmail(nextEmail);
    }

    window.addEventListener(ACCOUNT_IDENTITY_CHANGED_EVENT, onIdentityChanged);
    return () =>
      window.removeEventListener(
        ACCOUNT_IDENTITY_CHANGED_EVENT,
        onIdentityChanged,
      );
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const node = ref.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
    <div ref={ref} className="relative">
      <button
        type="button"
        className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 active:bg-muted/40"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        onClick={() => setOpen((v) => !v)}
      >
        {label} ▾
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/5 supports-[backdrop-filter]:bg-popover/95 supports-[backdrop-filter]:backdrop-blur-xl"
          role="menu"
        >
          <div className="border-b px-3 py-3">
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Signed in as
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">
              {displayName}
            </div>
            {email && email !== displayName ? (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {email}
              </div>
            ) : null}
            {productTier || role ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {productTier ? (
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">
                    {productTierLabel(productTier)}
                  </span>
                ) : null}
                {role ? (
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">
                    {roleLabel(role)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav className="py-1 text-sm">
            <AccountMenuLink
              href="/settings/assistant-profile"
              onNavigate={() => setOpen(false)}
            >
              Personalization
            </AccountMenuLink>
            <AccountMenuLink
              href="/settings/appearance"
              onNavigate={() => setOpen(false)}
            >
              Appearance
            </AccountMenuLink>
            <AccountMenuLink
              href="/settings/voice"
              onNavigate={() => setOpen(false)}
            >
              Voice
            </AccountMenuLink>
            <div className="my-1 border-t" />

            <AccountMenuLink
              href="/settings/account"
              onNavigate={() => setOpen(false)}
            >
              Account
            </AccountMenuLink>
            <AccountMenuLink
              href="/settings/security"
              onNavigate={() => setOpen(false)}
            >
              Security
            </AccountMenuLink>
            <AccountMenuLink
              href="/settings/data-privacy"
              onNavigate={() => setOpen(false)}
            >
              Data &amp; Privacy
            </AccountMenuLink>
            {hasAdminAccess ? (
              <AccountMenuLink href="/admin" onNavigate={() => setOpen(false)}>
                Admin Console
              </AccountMenuLink>
            ) : null}

            <div className="my-1 border-t" />

            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
              role="menuitem"
            >
              Sign out
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenuLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  function rememberReturnTarget() {
    try {
      const here =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      if (here && !here.startsWith("/settings") && here !== "/admin") {
        window.sessionStorage.setItem("vs_settings_return_to", here);
      }
    } catch {
      // ignore
    }

    onNavigate();
  }

  return (
    <Link
      href={href}
      className="block px-3 py-2 hover:bg-muted/60"
      role="menuitem"
      onClick={rememberReturnTarget}
    >
      {children}
    </Link>
  );
}
