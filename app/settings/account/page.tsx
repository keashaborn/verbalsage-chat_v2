"use client";

import * as React from "react";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";
import {
  ACCOUNT_IDENTITY_CHANGED_EVENT,
  normalizeAccountFullName,
} from "@/lib/accountIdentity";
import { supabase } from "@/lib/supabaseClient";

function displayNameFromUser(user: any) {
  return (
    normalizeAccountFullName(user?.user_metadata?.full_name) ||
    (user?.email as string | undefined)?.trim() ||
    "Signed in user"
  );
}

export default function AccountSettingsPage() {
  const [label, setLabel] = React.useState("Loading…");
  const [fullName, setFullName] = React.useState("");
  const [savedFullName, setSavedFullName] = React.useState("");
  const [email, setEmail] = React.useState<string | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [metadata, setMetadata] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!alive) return;

        const user = data.user;
        const loadedFullName = normalizeAccountFullName(
          user?.user_metadata?.full_name,
        );
        setLabel(displayNameFromUser(user));
        setFullName(loadedFullName);
        setSavedFullName(loadedFullName);
        setEmail((user?.email as string | undefined) || null);
        setEmailVerified(
          Boolean(user?.email_confirmed_at || user?.confirmed_at),
        );
        setMetadata(
          (user?.user_metadata as Record<string, unknown> | undefined) || {},
        );
      } catch {
        if (!alive) return;
        setLabel("Signed in user");
        setEmail(null);
        setStatus("Account details could not be loaded.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function saveIdentity() {
    const nextFullName = normalizeAccountFullName(fullName);
    if (!nextFullName) {
      setStatus("Enter your full name.");
      return;
    }
    if (nextFullName.length > 120) {
      setStatus("Use 120 characters or fewer.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const nextMetadata = { ...metadata, full_name: nextFullName };
      const { data, error } = await supabase.auth.updateUser({
        data: nextMetadata,
      });
      if (error) throw error;

      setMetadata(
        (data.user?.user_metadata as Record<string, unknown> | undefined) ||
          nextMetadata,
      );
      setFullName(nextFullName);
      setSavedFullName(nextFullName);
      setLabel(nextFullName);
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_IDENTITY_CHANGED_EVENT, {
          detail: { fullName: nextFullName },
        }),
      );
      setStatus("Account name saved.");
    } catch {
      setStatus("Account name could not be saved. Try again.");
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

  return (
    <SettingsPageFrame
      title="Account"
      description="Manage your account identity and current session."
    >
      <div className="space-y-6">
        <section className="space-y-4 rounded-xl border p-4">
          <div>
            <h2 className="text-sm font-semibold">Account identity</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your full name identifies your account. It is separate from the
              nickname RESSE uses in conversation.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Full name</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={loading || saving}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email || ""}
              readOnly
              aria-readonly="true"
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            />
          </label>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Email status</span>
            <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {emailVerified ? "Verified" : "Not verified"}
            </span>
          </div>

          <button
            type="button"
            onClick={saveIdentity}
            disabled={
              loading ||
              saving ||
              !normalizeAccountFullName(fullName) ||
              normalizeAccountFullName(fullName) === savedFullName
            }
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save name"}
          </button>

          <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div>
            <h2 className="text-sm font-semibold">Current session</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed in as {label}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
          >
            Sign out
          </button>
        </section>
      </div>
    </SettingsPageFrame>
  );
}
