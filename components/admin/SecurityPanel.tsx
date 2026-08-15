"use client";

import { authFetch } from "@/lib/authFetch";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/auth/TurnstileWidget";
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
  const headingId = React.useId();

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      <div className="border-y border-muted/20">
        <div className="divide-y divide-muted/20">{children}</div>
      </div>
      {footer != null && (
        <div className="px-1 text-xs leading-relaxed text-muted-foreground">
          {footer}
        </div>
      )}
    </section>
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
        "min-h-11 w-full px-3 py-3 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
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
      className="min-h-11 rounded-md border px-3 py-2 text-sm hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
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
  if (minutes === 10080) return "the last 7 days";
  if (minutes === 43200) return "the last 30 days";
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

type TotpFactor = {
  id: string;
  friendlyName: string;
};

type TotpEnrollment = {
  id: string;
  friendlyName: string;
  qrCode: string;
  secret: string;
};

function safeTotpQrSource(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("data:image/svg+xml")) return value;
  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
  }
  return "";
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

type SecurityPanelView = "all" | "security" | "data";

export function SecurityPanel({ view = "all" }: { view?: SecurityPanelView }) {
  const showSecurity = view !== "data";
  const showData = view !== "security";
  const [email, setEmail] = React.useState<string | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [lastSignInAt, setLastSignInAt] = React.useState<string | null>(null);
  const [accountLoading, setAccountLoading] = React.useState(true);
  const [passwordBusy, setPasswordBusy] = React.useState(false);
  const [passwordResetToken, setPasswordResetToken] = React.useState("");
  const passwordResetTurnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const [sessionsBusy, setSessionsBusy] = React.useState(false);
  const [securityStatus, setSecurityStatus] = React.useState("");
  const [accountRole, setAccountRole] = React.useState("");
  const [mfaLoading, setMfaLoading] = React.useState(true);
  const [mfaBusy, setMfaBusy] = React.useState(false);
  const [mfaCurrentLevel, setMfaCurrentLevel] = React.useState<
    "aal1" | "aal2" | null
  >(null);
  const [mfaFactors, setMfaFactors] = React.useState<TotpFactor[]>([]);
  const [mfaPendingFactorIds, setMfaPendingFactorIds] = React.useState<
    string[]
  >([]);
  const [mfaEnrollment, setMfaEnrollment] =
    React.useState<TotpEnrollment | null>(null);
  const [mfaCode, setMfaCode] = React.useState("");
  const [mfaStatus, setMfaStatus] = React.useState("");

  const [exportBusy, setExportBusy] = React.useState(false);
  const [forgetMinutes, setForgetMinutes] = React.useState<number>(60);
  const [forgetBusy, setForgetBusy] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [dataStatus, setDataStatus] = React.useState("");

  const loadMfaState = React.useCallback(async () => {
    setMfaLoading(true);
    try {
      const [factorResult, assuranceResult] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorResult.error) throw factorResult.error;
      if (assuranceResult.error) throw assuranceResult.error;

      setMfaFactors(
        (factorResult.data?.totp || []).map((factor, index) => ({
          id: factor.id,
          friendlyName:
            String(factor.friendly_name || "").trim() ||
            `Authenticator ${index + 1}`,
        })),
      );
      setMfaPendingFactorIds(
        (factorResult.data?.all || [])
          .filter(
            (factor) =>
              factor.factor_type === "totp" && factor.status === "unverified",
          )
          .map((factor) => factor.id),
      );
      const currentLevel = assuranceResult.data?.currentLevel;
      setMfaCurrentLevel(
        currentLevel === "aal1"
          ? "aal1"
          : currentLevel === "aal2"
            ? "aal2"
            : null,
      );
    } catch {
      setMfaStatus("Multi-factor details could not be loaded. Try again.");
    } finally {
      setMfaLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!showSecurity) {
      setAccountLoading(false);
      setMfaLoading(false);
      return;
    }

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
        const role = String(data.user?.app_metadata?.role || "");
        setAccountRole(role);
        if (role === "owner" || role === "admin") {
          await loadMfaState();
        } else {
          setMfaLoading(false);
        }
      } catch {
        if (alive) {
          setSecurityStatus("Account security details could not be loaded.");
          setMfaLoading(false);
        }
      } finally {
        if (alive) setAccountLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadMfaState, showSecurity]);

  async function sendPasswordCode() {
    if (!email || !emailVerified) {
      setSecurityStatus("A verified email address is required.");
      return;
    }
    if (!passwordResetToken) {
      setSecurityStatus(
        "Complete the security check before requesting a password-change code.",
      );
      return;
    }

    setPasswordBusy(true);
    setSecurityStatus("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/accept-invite`,
        captchaToken: passwordResetToken,
      });
      if (error) throw error;
      setSecurityStatus(`Password-change code sent to ${email}.`);
    } catch {
      setSecurityStatus(
        "The password-change email could not be sent. Try again later.",
      );
    } finally {
      passwordResetTurnstileRef.current?.reset();
      setPasswordResetToken("");
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

  async function startMfaEnrollment() {
    if (accountRole !== "owner" && accountRole !== "admin") return;
    if (mfaFactors.length >= 2) {
      setMfaStatus("Two authenticators are already enrolled.");
      return;
    }

    setMfaBusy(true);
    setMfaStatus("");
    try {
      for (const factorId of mfaPendingFactorIds) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
      }

      const friendlyName =
        mfaFactors.length === 0 ? "LifeSwitch primary" : "LifeSwitch backup";
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
        issuer: "LifeSwitch",
      });
      if (error) throw error;

      const qrCode = safeTotpQrSource(data.totp.qr_code);
      if (!qrCode || !data.totp.secret) {
        await supabase.auth.mfa.unenroll({ factorId: data.id });
        throw new Error("Invalid enrollment response.");
      }

      setMfaEnrollment({
        id: data.id,
        friendlyName,
        qrCode,
        secret: data.totp.secret,
      });
      setMfaPendingFactorIds([data.id]);
      setMfaCode("");
      setMfaStatus(
        "Scan the QR code, then verify one code before leaving this page.",
      );
    } catch {
      setMfaStatus("Authenticator setup could not be started. Try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyMfaEnrollment() {
    if (!mfaEnrollment) return;
    const code = mfaCode.replace(/\s+/g, "");
    if (!/^[0-9]{6}$/.test(code)) {
      setMfaStatus("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setMfaBusy(true);
    setMfaStatus("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.id,
        code,
      });
      if (error) throw error;

      setMfaEnrollment(null);
      setMfaCode("");
      setMfaPendingFactorIds([]);
      await loadMfaState();
      setMfaStatus(
        "Authenticator verified. Other saved sessions were signed out.",
      );
    } catch {
      setMfaStatus(
        "That authenticator code was invalid or expired. Try again.",
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function cancelMfaEnrollment() {
    if (!mfaEnrollment) return;
    setMfaBusy(true);
    setMfaStatus("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: mfaEnrollment.id,
      });
      if (error) throw error;
      setMfaEnrollment(null);
      setMfaCode("");
      setMfaPendingFactorIds([]);
      await loadMfaState();
      setMfaStatus("Authenticator setup cancelled.");
    } catch {
      setMfaStatus("Authenticator setup could not be cancelled. Try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function copyMfaSecret() {
    if (!mfaEnrollment) return;
    try {
      await navigator.clipboard.writeText(mfaEnrollment.secret);
      setMfaStatus("Manual setup key copied.");
    } catch {
      setMfaStatus("The setup key could not be copied.");
    }
  }

  async function removeMfaFactor(factor: TotpFactor) {
    if (mfaCurrentLevel !== "aal2" || mfaFactors.length <= 1) return;
    const confirmed = window.confirm(
      `Remove ${factor.friendlyName}? Keep at least one independent backup authenticator.`,
    );
    if (!confirmed) return;

    setMfaBusy(true);
    setMfaStatus("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (error) throw error;
      await loadMfaState();
      setMfaStatus(`${factor.friendlyName} removed.`);
    } catch {
      setMfaStatus("The authenticator could not be removed. Try again.");
    } finally {
      setMfaBusy(false);
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
      window.location.reload();
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
      window.location.reload();
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

  const privilegedAccount = accountRole === "owner" || accountRole === "admin";
  const mfaReadyForEnforcement = mfaFactors.length >= 2;

  return (
    <div className="space-y-5">
      {showSecurity ? (
        <>
          <Group
            title="Password"
            footer={
              <>
                Password changes use a one-time code sent to your verified
                email.
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
                <span
                  className={`text-xs font-medium ${
                    emailVerified
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
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
                </div>
              }
              right={
                <SmallButton
                  onClick={() => void sendPasswordCode()}
                  disabled={
                    accountLoading ||
                    passwordBusy ||
                    !email ||
                    !emailVerified ||
                    !passwordResetToken
                  }
                >
                  {passwordBusy ? "Sending…" : "Email change code"}
                </SmallButton>
              }
            >
              <TurnstileWidget
                ref={passwordResetTurnstileRef}
                action="password_reset"
                onToken={setPasswordResetToken}
              />
            </Row>
          </Group>

          <Group
            title="Sessions"
            footer={
              <>
                Other sessions can remain active briefly until their current
                access token expires.
              </>
            }
          >
            <Row
              left={
                <div>
                  <div className="font-medium">Last successful sign-in</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {accountLoading
                      ? "Loading…"
                      : formatLastSignIn(lastSignInAt)}
                  </div>
                </div>
              }
            />
            <Row
              left={
                <div>
                  <div className="font-medium">Other sessions</div>
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

          {privilegedAccount && (
            <>
              <Group
                title="Authenticators"
                footer={
                  <>
                    Enroll a primary authenticator and an independent backup
                    before owner-operation enforcement is enabled. Supabase does
                    not issue recovery codes for TOTP factors.
                  </>
                }
              >
                <Row
                  left={
                    <div>
                      <div className="font-medium">Authenticator status</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {mfaLoading
                          ? "Checking…"
                          : mfaFactors.length === 0
                            ? "No verified authenticators"
                            : mfaFactors.length === 1
                              ? "Primary verified; backup still required"
                              : "Primary and backup verified"}
                      </div>
                    </div>
                  }
                  right={
                    <span
                      className={`text-xs font-medium ${
                        mfaReadyForEnforcement
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {mfaLoading
                        ? "Checking"
                        : mfaReadyForEnforcement
                          ? "Ready"
                          : mfaFactors.length === 1
                            ? "Backup needed"
                            : "Not started"}
                    </span>
                  }
                />

                <Row
                  left={
                    <div>
                      <div className="font-medium">Current session</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {mfaLoading
                          ? "Checking authenticator assurance…"
                          : mfaCurrentLevel === "aal2"
                            ? "Password and authenticator verified"
                            : "Password or email verification only"}
                      </div>
                    </div>
                  }
                  right={
                    <span
                      className={`text-xs font-medium ${
                        mfaCurrentLevel === "aal2"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {mfaLoading
                        ? "Checking"
                        : mfaCurrentLevel === "aal2"
                          ? "Protected"
                          : "Standard"}
                    </span>
                  }
                />

                {mfaFactors.map((factor) => (
                  <Row
                    key={factor.id}
                    left={
                      <div>
                        <div className="font-medium">{factor.friendlyName}</div>
                      </div>
                    }
                    right={
                      <SmallButton
                        onClick={() => void removeMfaFactor(factor)}
                        disabled={
                          mfaBusy ||
                          mfaCurrentLevel !== "aal2" ||
                          mfaFactors.length <= 1
                        }
                      >
                        Remove
                      </SmallButton>
                    }
                  />
                ))}

                {!mfaEnrollment && mfaFactors.length < 2 && (
                  <ActionRow
                    label={
                      mfaBusy
                        ? "Starting setup…"
                        : mfaFactors.length === 0
                          ? "Set up primary authenticator"
                          : "Add independent backup authenticator"
                    }
                    onClick={() => void startMfaEnrollment()}
                    disabled={mfaLoading || mfaBusy}
                  />
                )}

                {mfaEnrollment && (
                  <Row
                    left={
                      <div>
                        <div className="font-medium">
                          Set up {mfaEnrollment.friendlyName}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Scan this QR code with an authenticator app. Then
                          enter its current 6-digit code.
                        </div>
                      </div>
                    }
                  >
                    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                      <div className="rounded-xl border bg-white p-3">
                        <img
                          src={mfaEnrollment.qrCode}
                          alt="LifeSwitch authenticator enrollment QR code"
                          className="mx-auto size-36"
                        />
                      </div>
                      <div className="grid content-start gap-3">
                        <label className="grid gap-1 text-xs">
                          <span>Manual setup key</span>
                          <input
                            className="w-full rounded-lg border bg-background px-3 py-2 font-mono"
                            type="password"
                            value={mfaEnrollment.secret}
                            readOnly
                            autoComplete="off"
                          />
                        </label>
                        <SmallButton
                          onClick={() => void copyMfaSecret()}
                          disabled={mfaBusy}
                        >
                          Copy setup key
                        </SmallButton>
                        <label className="grid gap-1 text-xs">
                          <span>Authenticator code</span>
                          <input
                            className="w-full rounded-lg border bg-background px-3 py-2 font-mono tracking-[0.2em]"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={mfaCode}
                            onChange={(event) =>
                              setMfaCode(
                                event.target.value
                                  .replace(/[^0-9]/g, "")
                                  .slice(0, 6),
                              )
                            }
                            disabled={mfaBusy}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <SmallButton
                            onClick={() => void verifyMfaEnrollment()}
                            disabled={mfaBusy || mfaCode.length !== 6}
                          >
                            {mfaBusy ? "Verifying…" : "Verify authenticator"}
                          </SmallButton>
                          <SmallButton
                            onClick={() => void cancelMfaEnrollment()}
                            disabled={mfaBusy}
                          >
                            Cancel
                          </SmallButton>
                        </div>
                      </div>
                    </div>
                  </Row>
                )}
              </Group>

              <p
                className="min-h-5 px-1 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {mfaStatus}
              </p>
            </>
          )}

          <p
            className="min-h-5 px-1 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {securityStatus}
          </p>
        </>
      ) : null}

      {showData ? (
        <>
          <Group title="Export">
            <Row
              left={
                <div>
                  <div className="font-medium">
                    Conversation and memory data
                  </div>
                </div>
              }
              right={
                <SmallButton
                  disabled={exportBusy}
                  onClick={() => void downloadExport()}
                >
                  {exportBusy ? "Preparing…" : "Download"}
                </SmallButton>
              }
            />
          </Group>

          <Group
            title="Forget recent conversations"
            footer={
              <>
                Deletes recent transcript rows and matching conversational
                memory.
              </>
            }
          >
            <Row
              left="Time range"
              right={
                <select
                  className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
                  value={forgetMinutes}
                  onChange={(event) =>
                    setForgetMinutes(Number(event.target.value))
                  }
                  disabled={forgetBusy}
                >
                  <option value={60}>Last 1 hour</option>
                  <option value={1440}>Last 24 hours</option>
                  <option value={10080}>Last 7 days</option>
                  <option value={43200}>Last 30 days</option>
                </select>
              }
            />
            <ActionRow
              label={
                forgetBusy ? "Forgetting…" : "Forget selected conversations"
              }
              disabled={forgetBusy}
              onClick={() => void forgetRecent()}
            />
          </Group>

          <details
            className="group overflow-hidden border-y border-muted/30"
            onToggle={(event) => {
              if (!event.currentTarget.open) setDeleteConfirm("");
            }}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-3 py-3 text-sm hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              <div>
                <div className="font-medium">Delete chat data</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Permanently remove all conversations and conversational
                  memory.
                </div>
              </div>
              <span
                className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                aria-hidden="true"
              >
                ›
              </span>
            </summary>

            <div className="border-t border-red-500/30 bg-red-500/[0.03]">
              <Row
                left={
                  <div>
                    <div className="font-medium text-red-600 dark:text-red-400">
                      Delete conversation and memory data
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Permanently deletes all chat threads, transcripts, and
                      stored conversational memory. Your sign-in account and
                      structured LifeSwitch tracking data remain active.
                    </p>
                    <p className="mt-3">
                      Type{" "}
                      <span className="font-semibold">DELETE CHAT DATA</span> to
                      confirm.
                    </p>
                  </div>
                }
              >
                <input
                  className="mt-2 w-full rounded-lg border bg-background px-2 py-2 text-sm outline-none"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder="DELETE CHAT DATA"
                  autoComplete="off"
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
            </div>
          </details>

          <p
            className="min-h-5 px-1 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {dataStatus}
          </p>
        </>
      ) : null}
    </div>
  );
}
