"use client";

import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabaseClient";
import * as React from "react";

function Group({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
      {footer != null && (
        <div className="px-1 text-xs leading-relaxed text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

function Row({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "w-full px-3 py-3 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
        danger ? "text-red-500" : "",
      ].join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function forgetLabel(minutes: number) {
  if (minutes === 15) return "the last 15 minutes";
  if (minutes === 60) return "the last hour";
  if (minutes === 240) return "the last 4 hours";
  if (minutes === 1440) return "the last 24 hours";
  return `the last ${minutes} minutes`;
}

function formatLastSignIn(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function protectedActionError(
  response: Response,
  fallback: string,
): Promise<string> {
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 428
  ) {
    return "For security, sign in again before retrying this action.";
  }
  return fallback;
}

export function SecurityPanel() {
  const [email, setEmail] = React.useState<string | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [lastSignInAt, setLastSignInAt] = React.useState<string | null>(null);
  const [accountLoading, setAccountLoading] = React.useState(true);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [sessionsBusy, setSessionsBusy] = React.useState(false);
  const [securityStatus, setSecurityStatus] = React.useState("");

  const [exportBusy, setExportBusy] = React.useState(false);
  const [forgetMinutes, setForgetMinutes] = React.useState<number>(60);
  const [forgetBusy, setForgetBusy] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [dataStatus, setDataStatus] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!alive) return;

        setEmail(data.user?.email || null);
        setEmailVerified(
          Boolean(data.user?.email_confirmed_at || data.user?.confirmed_at),
        );
        setLastSignInAt(data.user?.last_sign_in_at || null);
      } catch {
        if (alive) {
          setSecurityStatus("Account security details could not be loaded.");
        }
      } finally {
        if (alive) setAccountLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function sendPasswordCode() {
    if (!email || !emailVerified) {
      setSecurityStatus("A verified email address is required.");
      return;
    }

    setPasswordBusy(true);
    setSecurityStatus("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/accept-invite`,
      });
      if (error) throw error;
      setSecurityStatus(`Password-change code sent to ${email}.`);
    } catch {
      setSecurityStatus(
        "The password-change email could not be sent. Try again later.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOutOtherSessions() {
    setSessionsBusy(true);
    setSecurityStatus("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      setSecurityStatus(
        "Other sessions were revoked. This device remains signed in.",
      );
    } catch {
      setSecurityStatus("Other sessions could not be revoked. Try again.");
    } finally {
      setSessionsBusy(false);
    }
  }

  async function downloadExport() {
    setExportBusy(true);
    setDataStatus("");
    try {
      const response = await authFetch("/api/admin/export", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          await protectedActionError(
            response,
            "The data download could not be prepared.",
          ),
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");

      link.href = url;
      link.download = `lifeswitch-conversation-data-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDataStatus("Data download started.");
    } catch (error: unknown) {
      setDataStatus(
        error instanceof Error
          ? error.message
          : "The data download could not be prepared.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function forgetRecent() {
    const confirmed = window.confirm(
      `Permanently forget conversations from ${forgetLabel(forgetMinutes)}?`,
    );
    if (!confirmed) return;

    setForgetBusy(true);
    setDataStatus("");
    try {
      const response = await authFetch(
        `/api/admin/forget_recent?minutes=${encodeURIComponent(String(forgetMinutes))}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(
          await protectedActionError(
            response,
            "Recent conversations could not be forgotten.",
          ),
        );
      }
      setDataStatus(`Forgot conversations from ${forgetLabel(forgetMinutes)}.`);
    } catch (error: unknown) {
      setDataStatus(
        error instanceof Error
          ? error.message
          : "Recent conversations could not be forgotten.",
      );
    } finally {
      setForgetBusy(false);
    }
  }

  async function deleteConversationData() {
    const confirmed = window.confirm(
      "Permanently delete all conversation and memory data? Your LifeSwitch account and structured tracking data will remain active.",
    );
    if (!confirmed) return;

    setDeletingAll(true);
    setDataStatus("");
    try {
      const response = await authFetch("/api/admin/delete_all", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await protectedActionError(
            response,
            "Conversation and memory data could not be deleted.",
          ),
        );
      }
      setDeleteConfirm("");
      setDataStatus(
        "Conversation and memory data deleted. Your LifeSwitch account remains active.",
      );
    } catch (error: unknown) {
      setDataStatus(
        error instanceof Error
          ? error.message
          : "Conversation and memory data could not be deleted.",
      );
    } finally {
      setDeletingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <Group
        title="Account security"
        footer={
          <>
            Password changes use a one-time code sent to your verified email.
            Other sessions can remain active briefly until their current access
            token expires.
          </>
        }
      >
        <Row
          left={
            <div>
              <div className="font-medium">Verified email</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {accountLoading ? "Loading…" : email || "Unavailable"}
              </div>
            </div>
          }
          right={
            <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {accountLoading
                ? "Checking"
                : emailVerified
                  ? "Verified"
                  : "Not verified"}
            </span>
          }
        />
        <Row
          left={
            <div>
              <div className="font-medium">Password</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Send a private code before choosing a new password.
              </div>
            </div>
          }
          right={
            <SmallButton
              onClick={() => void sendPasswordCode()}
              disabled={
                accountLoading || passwordBusy || !email || !emailVerified
              }
            >
              {passwordBusy ? "Sending…" : "Email change code"}
            </SmallButton>
          }
        />
        <Row
          left={
            <div>
              <div className="font-medium">Last successful sign-in</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {accountLoading ? "Loading…" : formatLastSignIn(lastSignInAt)}
              </div>
            </div>
          }
        />
        <Row
          left={
            <div>
              <div className="font-medium">Other sessions</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Revoke saved sessions on other browsers and devices.
              </div>
            </div>
          }
          right={
            <SmallButton
              onClick={() => void signOutOtherSessions()}
              disabled={accountLoading || sessionsBusy}
            >
              {sessionsBusy ? "Revoking…" : "Sign out others"}
            </SmallButton>
          }
        />
      </Group>

      <p
        className="min-h-5 px-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {securityStatus}
      </p>

      <div>
        <h2 className="text-sm font-semibold">Data &amp; privacy</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Download or remove your Verbal Sage conversation and memory data.
          These controls do not delete your login or structured LifeSwitch
          tracking records.
        </p>
      </div>

      <Group
        title="Download"
        footer={
          <>
            Downloads chat threads, transcripts, and latest memory cards as
            JSON.
          </>
        }
      >
        <ActionRow
          label={exportBusy ? "Preparing download…" : "Download my data"}
          disabled={exportBusy}
          onClick={() => void downloadExport()}
        />
      </Group>

      <Group
        title="Forget recent conversations"
        footer={
          <>
            Deletes recent transcript rows and matching conversational memory.
          </>
        }
      >
        <Row
          left="Time range"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={forgetMinutes}
              onChange={(event) => setForgetMinutes(Number(event.target.value))}
              disabled={forgetBusy}
            >
              <option value={15}>Last 15 minutes</option>
              <option value={60}>Last 1 hour</option>
              <option value={240}>Last 4 hours</option>
              <option value={1440}>Last 24 hours</option>
            </select>
          }
        />
        <ActionRow
          label={forgetBusy ? "Forgetting…" : "Forget selected conversations"}
          disabled={forgetBusy}
          onClick={() => void forgetRecent()}
        />
      </Group>

      <Group
        title="Delete conversation and memory data"
        footer={
          <>
            Permanently deletes all chat threads, transcripts, and stored
            conversational memory. Your sign-in account and structured
            LifeSwitch tracking data remain active.
          </>
        }
      >
        <Row
          left={
            <>
              Type <span className="font-semibold">DELETE CHAT DATA</span> to
              confirm
            </>
          }
        >
          <input
            className="mt-2 w-full rounded-lg border bg-background px-2 py-2 text-sm outline-none"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder="DELETE CHAT DATA"
          />
        </Row>

        <ActionRow
          label={
            deletingAll
              ? "Deleting conversation data…"
              : "Delete conversation and memory data"
          }
          danger
          disabled={deleteConfirm !== "DELETE CHAT DATA" || deletingAll}
          onClick={() => void deleteConversationData()}
        />
      </Group>

      <p
        className="min-h-5 px-1 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {dataStatus}
      </p>
    </div>
  );
}
