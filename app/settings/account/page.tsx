"use client";

import * as React from "react";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";
import { authFetch } from "@/lib/authFetch";
import {
  ACCOUNT_IDENTITY_CHANGED_EVENT,
  normalizeAccountFullName,
} from "@/lib/accountIdentity";
import { productTierLabel } from "@/lib/productEntitlements";
import { supabase } from "@/lib/supabaseClient";

type AccountAccess = {
  role: string;
  productTier: unknown;
};

function displayNameFromUser(user: any) {
  return (
    normalizeAccountFullName(user?.user_metadata?.full_name) ||
    (user?.email as string | undefined)?.trim() ||
    "Signed in user"
  );
}

function roleLabel(role: unknown) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Administrator";
  return "Member";
}

function identityInitial(label: string) {
  const value = label.trim();
  return value ? value.charAt(0).toLocaleUpperCase() : "A";
}

export default function AccountSettingsPage() {
  const [label, setLabel] = React.useState("Loading…");
  const [fullName, setFullName] = React.useState("");
  const [savedFullName, setSavedFullName] = React.useState("");
  const [email, setEmail] = React.useState<string | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [access, setAccess] = React.useState<AccountAccess | null>(null);
  const [accessLoading, setAccessLoading] = React.useState(true);
  const [accessUnavailable, setAccessUnavailable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const loadAccountDetails = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setAccessLoading(true);
    setAccessUnavailable(false);
    setStatus("");

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error || new Error("User unavailable");

      const user = data.user;
      const loadedFullName = normalizeAccountFullName(
        user.user_metadata?.full_name,
      );
      setLabel(displayNameFromUser(user));
      setFullName(loadedFullName);
      setSavedFullName(loadedFullName);
      setEmail((user.email as string | undefined)?.trim() || null);
      setEmailVerified(Boolean(user.email_confirmed_at || user.confirmed_at));
    } catch {
      setLabel("Signed in user");
      setEmail(null);
      setEmailVerified(false);
      setAccess(null);
      setAccessLoading(false);
      setLoadError(true);
      setLoading(false);
      return;
    }

    setLoading(false);

    try {
      const response = await authFetch("/api/auth/capabilities", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!payload?.authenticated || typeof payload.role !== "string") {
        throw new Error("Access unavailable");
      }
      setAccess({
        role: payload.role,
        productTier: payload.product_tier,
      });
    } catch {
      setAccess(null);
      setAccessUnavailable(true);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAccountDetails();
  }, [loadAccountDetails]);

  async function saveIdentity() {
    const nextFullName = normalizeAccountFullName(fullName);
    if (nextFullName.length > 120) {
      setStatus("Use 120 characters or fewer.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: nextFullName || null },
      });
      if (error) throw error;

      const savedName = normalizeAccountFullName(
        data.user?.user_metadata?.full_name,
      );
      const savedEmail =
        (data.user?.email as string | undefined)?.trim() || email || "";
      setFullName(savedName);
      setSavedFullName(savedName);
      setLabel(savedName || savedEmail || "Signed in user");
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_IDENTITY_CHANGED_EVENT, {
          detail: { fullName: savedName, email: savedEmail },
        }),
      );
      setStatus(savedName ? "Display name saved." : "Display name removed.");
    } catch {
      setStatus("Display name could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  const normalizedFullName = normalizeAccountFullName(fullName);

  return (
    <SettingsPageFrame
      title="Account"
      description="Manage your account identity and current session."
    >
      <div className="space-y-8">
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Account identity</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your sign-in identity and current product access.
            </p>
          </div>

          {loading ? (
            <div
              className="rounded-xl border border-muted/30 px-4 py-5 text-sm text-muted-foreground"
              role="status"
            >
              Loading account details…
            </div>
          ) : loadError ? (
            <div
              className="rounded-xl border border-muted/30 px-4 py-4"
              role="alert"
            >
              <div className="text-sm font-medium">
                Account details could not be loaded.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your session may have expired or the identity service may be
                temporarily unavailable.
              </p>
              <button
                type="button"
                onClick={() => void loadAccountDetails()}
                className="mt-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-muted/30 bg-muted/[0.08] p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="product-brand-primary flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    aria-hidden="true"
                  >
                    {identityInitial(label)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">
                      {label}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {email}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          emailVerified
                            ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            : "border-amber-500/30 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {emailVerified ? "Verified" : "Not verified"}
                      </span>
                      {access ? (
                        <>
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                            {productTierLabel(access.productTier)}
                          </span>
                          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">
                            {roleLabel(access.role)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Display name{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
                <span className="block text-xs text-muted-foreground">
                  Shown in the account menu. Your email remains your sign-in
                  identity.
                </span>
              </label>

              <div className="divide-y divide-muted/20 border-y border-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">Sign-in email</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {email}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      emailVerified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {emailVerified ? "Verified" : "Not verified"}
                  </span>
                </div>

                <div className="grid gap-3 py-3 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Product plan</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {access
                        ? productTierLabel(access.productTier)
                        : accessLoading
                          ? "Loading…"
                          : "Unavailable"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Account role</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {access
                        ? roleLabel(access.role)
                        : accessLoading
                          ? "Loading…"
                          : "Unavailable"}
                    </div>
                  </div>
                  {accessUnavailable ? (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Access details could not be loaded. Your existing access
                      has not changed.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {status}
                </p>
                <button
                  type="button"
                  onClick={saveIdentity}
                  disabled={saving || normalizedFullName === savedFullName}
                  className="product-brand-primary rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t border-muted/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Current session</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {email ? `Signed in as ${email}` : "Session details unavailable"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="self-start rounded-md border px-3 py-2 text-sm hover:bg-muted/40 sm:self-auto"
          >
            Sign out
          </button>
        </section>
      </div>
    </SettingsPageFrame>
  );
}
