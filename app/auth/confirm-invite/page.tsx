"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { validateAccessInviteConfirmationUrl } from "@/lib/accessInviteConfirmation";

export default function ConfirmAccessInvitePage() {
  const [checking, setChecking] = useState(true);
  const [confirmationUrl, setConfirmationUrl] = useState("");

  useEffect(() => {
    const rawConfirmationUrl = new URLSearchParams(
      window.location.search,
    ).get("confirmation_url");
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
    <main className="mx-auto min-h-screen max-w-2xl p-4 py-10 sm:py-16">
      <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-7">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          LifeSwitch
        </div>

        <h1 className="mt-2 text-2xl font-semibold">
          Accept your LifeSwitch invitation
        </h1>

        <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>
            Your access request was approved. Confirm the invitation to create
            your password and finish setting up your account.
          </p>
          <p>
            This extra confirmation protects invitation links from automated
            email security checks.
          </p>
        </div>

        {checking ? (
          <div className="mt-5 rounded-xl border p-4 text-sm text-muted-foreground">
            Verifying invitation…
          </div>
        ) : confirmationUrl ? (
          <div className="mt-5 grid gap-4 rounded-2xl border p-4 sm:p-5">
            <div className="text-sm">
              Continue only if you requested access to LifeSwitch.
            </div>
            <button
              type="button"
              className="w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40"
              onClick={acceptInvitation}
            >
              Accept invitation
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
              This invitation link is incomplete or invalid. Ask the LifeSwitch
              owner to send a new invitation.
            </div>
            <Link
              href="/"
              className="inline-flex w-fit rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted/40"
            >
              Return to LifeSwitch
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
