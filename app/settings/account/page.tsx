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

type AccountTimezone = {
  timezone_name: string | null;
  source: "account_setting" | "reviewed_migration" | null;
  revision: number;
  updated_at: string | null;
};

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function timezoneChoices(...included: string[]) {
  let values: string[] = [];
  try {
    const supported = (
      Intl as typeof Intl & {
        supportedValuesOf?: (key: "timeZone") => string[];
      }
    ).supportedValuesOf;
    values = supported ? supported("timeZone") : [];
  } catch {}
  return Array.from(
    new Set(["UTC", ...included, ...values].filter(Boolean)),
  ).sort();
}

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
  const [, setAccessLoading] = React.useState(true);
  const [accessUnavailable, setAccessUnavailable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [timezoneLoading, setTimezoneLoading] = React.useState(true);
  const [timezoneLoadError, setTimezoneLoadError] = React.useState(false);
  const [timezoneName, setTimezoneName] = React.useState("");
  const [savedTimezoneName, setSavedTimezoneName] = React.useState("");
  const [timezoneRevision, setTimezoneRevision] = React.useState(0);
  const [timezoneSource, setTimezoneSource] =
    React.useState<AccountTimezone["source"]>(null);
  const [timezoneSaving, setTimezoneSaving] = React.useState(false);
  const [timezoneStatus, setTimezoneStatus] = React.useState("");
  const detectedTimezone = React.useMemo(deviceTimezone, []);
  const timezoneOptions = React.useMemo(
    () => timezoneChoices(timezoneName, detectedTimezone),
    [timezoneName, detectedTimezone],
  );

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

  const loadTimezoneDetails = React.useCallback(async () => {
    setTimezoneLoading(true);
    setTimezoneLoadError(false);
    setTimezoneStatus("");
    try {
      const response = await authFetch("/api/user/account-timezone", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AccountTimezone | null;
      if (!response.ok || !payload || !Number.isInteger(payload.revision)) {
        throw new Error("Timezone unavailable");
      }
      const loaded = payload.timezone_name || detectedTimezone;
      setTimezoneName(loaded);
      setSavedTimezoneName(payload.timezone_name || "");
      setTimezoneRevision(payload.revision);
      setTimezoneSource(payload.source);
    } catch {
      setTimezoneLoadError(true);
      setTimezoneName(detectedTimezone);
      setSavedTimezoneName("");
      setTimezoneRevision(0);
      setTimezoneSource(null);
    } finally {
      setTimezoneLoading(false);
    }
  }, [detectedTimezone]);

  React.useEffect(() => {
    void loadAccountDetails();
    void loadTimezoneDetails();
  }, [loadAccountDetails, loadTimezoneDetails]);

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

  async function saveTimezone() {
    if (!timezoneName || timezoneName.length > 80) {
      setTimezoneStatus("Choose a valid time zone.");
      return;
    }
    setTimezoneSaving(true);
    setTimezoneStatus("");
    try {
      const response = await authFetch("/api/user/account-timezone", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timezone_name: timezoneName,
          expected_revision: timezoneRevision,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AccountTimezone | null;
      if (response.status === 409) {
        setTimezoneStatus(
          "The time zone changed in another session. Reload and try again.",
        );
        return;
      }
      if (!response.ok || !payload?.timezone_name) {
        throw new Error("Timezone save failed");
      }
      setTimezoneName(payload.timezone_name);
      setSavedTimezoneName(payload.timezone_name);
      setTimezoneRevision(payload.revision);
      setTimezoneSource("account_setting");
      setTimezoneStatus("Time zone saved.");
    } catch {
      setTimezoneStatus("Time zone could not be saved. Try again.");
    } finally {
      setTimezoneSaving(false);
    }
  }

  async function saveAccountChanges() {
    if (normalizedFullName !== savedFullName) await saveIdentity();
    if (timezoneName && timezoneName !== savedTimezoneName) {
      await saveTimezone();
    }
  }

  const normalizedFullName = normalizeAccountFullName(fullName);
  const identityChanged = normalizedFullName !== savedFullName;
  const timezoneChanged =
    Boolean(timezoneName) && timezoneName !== savedTimezoneName;

  return (
    <SettingsPageFrame title="Account">
      <div className="space-y-8">
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Profile</h2>
          </div>

          {loading ? (
            <div
              className="border-y border-muted/30 px-1 py-5 text-sm text-muted-foreground"
              role="status"
            >
              Loading account details…
            </div>
          ) : loadError ? (
            <div className="border-y border-muted/30 px-1 py-4" role="alert">
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
              <div className="border-y border-muted/30 py-4">
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
              </label>

              {accessUnavailable ? (
                <p className="text-xs text-muted-foreground">
                  Access details are temporarily unavailable. Your access has
                  not changed.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="space-y-5 border-t border-muted/20 pt-6">
          <h2 className="text-base font-semibold">Time zone</h2>

          {timezoneLoading ? (
            <div className="py-3 text-sm text-muted-foreground" role="status">
              Loading time zone…
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Registered time zone
                </span>
                <select
                  value={timezoneName}
                  onChange={(event) => setTimezoneName(event.target.value)}
                  disabled={timezoneSaving}
                  className="min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {timezoneOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  This device reports{" "}
                  <span className="font-medium">{detectedTimezone}</span>.
                  {timezoneSource === "reviewed_migration"
                    ? " The current value was registered during migration."
                    : null}
                </div>
                <button
                  type="button"
                  onClick={() => setTimezoneName(detectedTimezone)}
                  disabled={timezoneSaving || timezoneName === detectedTimezone}
                  className="min-h-11 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-40"
                >
                  Use device
                </button>
              </div>

              {timezoneLoadError ? (
                <p
                  className="text-xs text-amber-700 dark:text-amber-400"
                  role="alert"
                >
                  The saved value could not be loaded. Nothing has been changed.
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t border-muted/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Current session</h2>

          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-11 self-start rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:self-auto"
          >
            Sign out
          </button>
        </section>

        <section className="flex flex-wrap items-center justify-end gap-3 border-t border-muted/20 pt-6">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {status || timezoneStatus}
          </p>
          <button
            type="button"
            onClick={() => void saveAccountChanges()}
            disabled={
              saving ||
              timezoneSaving ||
              timezoneLoading ||
              (!identityChanged && !timezoneChanged)
            }
            className="product-brand-primary min-h-11 rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving || timezoneSaving ? "Saving…" : "Save changes"}
          </button>
        </section>
      </div>
    </SettingsPageFrame>
  );
}
