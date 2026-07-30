"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PublicAuthNotice,
  PublicAuthShell,
  PUBLIC_AUTH_PRIMARY_ACTION_CLASS,
  PUBLIC_AUTH_SECONDARY_ACTION_CLASS,
  PUBLIC_AUTH_SECTION_CLASS,
} from "@/components/auth/PublicAuthShell";
import { validateAccessInviteConfirmationUrl } from "@/lib/accessInviteConfirmation";

export default function ConfirmAccessInvitePage() {
  const [checking, setChecking] = useState(true);
  const [confirmationUrl, setConfirmationUrl] = useState("");

  useEffect(() => {
    const rawConfirmationUrl = new URLSearchParams(window.location.search).get(
      "confirmation_url",
    );
    const validConfirmationUrl = validateAccessInviteConfirmationUrl(
      rawConfirmationUrl,
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      window.location.origin,
    );

    setConfirmationUrl(validConfirmationUrl || "");
    setChecking(false);
  }, []);

  function acceptInvitation() {
    if (!confirmationUrl) return;
    window.location.assign(confirmationUrl);
  }

  return (
    <PublicAuthShell
      title="Accept your LifeSwitch invitation"
      intro={
        <>
          <p>
            Your access request was approved. Confirm the invitation to create
            your password and finish setting up your account.
          </p>
          <p>
            This extra confirmation protects invitation links from automated
            email security checks.
          </p>
        </>
      }
    >
      {checking ? (
        <div
          className={`${PUBLIC_AUTH_SECTION_CLASS} text-sm text-muted-foreground`}
          role="status"
        >
          Verifying invitation…
        </div>
      ) : confirmationUrl ? (
        <div className={`${PUBLIC_AUTH_SECTION_CLASS} grid gap-4`}>
          <div className="text-sm">
            Continue only if you requested access to LifeSwitch.
          </div>
          <button
            type="button"
            className={`${PUBLIC_AUTH_PRIMARY_ACTION_CLASS} w-fit`}
            onClick={acceptInvitation}
          >
            Accept invitation
          </button>
        </div>
      ) : (
        <div className={`${PUBLIC_AUTH_SECTION_CLASS} grid gap-4`}>
          <PublicAuthNotice tone="error">
            This invitation link is incomplete or invalid. Ask the LifeSwitch
            owner to send a new invitation.
          </PublicAuthNotice>
          <Link
            href="/"
            className={`${PUBLIC_AUTH_SECONDARY_ACTION_CLASS} w-fit`}
          >
            Return to LifeSwitch
          </Link>
        </div>
      )}
    </PublicAuthShell>
  );
}
