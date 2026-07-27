"use client";

import Link from "next/link";
import * as React from "react";

import { authFetch } from "@/lib/authFetch";
import {
  dayIsInRecoveryPeriod,
  type RecoveryAdjustment,
  type RecoveryPeriod,
} from "@/lib/lifeswitch/recoveryAdjustments";

type RecoveryDomain = "nutrition" | "strength";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function readableDay(day: string): string {
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

function periodForDomain(
  adjustment: RecoveryAdjustment,
  domain: RecoveryDomain,
): RecoveryPeriod | null {
  return domain === "nutrition"
    ? adjustment.nutrition_period
    : adjustment.strength_period;
}

export function RecoveryAdjustmentApplied({
  domain,
  targetUserId = "",
}: {
  domain: RecoveryDomain;
  targetUserId?: string;
}) {
  const today = React.useMemo(() => localDay(), []);
  const [period, setPeriod] = React.useState<RecoveryPeriod | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(
          "/api/lifeswitch/plan/agentic/recovery-adjustments",
          window.location.origin,
        );
        url.searchParams.set("starts_on", today);
        url.searchParams.set("ends_on", today);
        if (targetUserId) url.searchParams.set("target_user_id", targetUserId);

        const response = await authFetch(url.toString(), { cache: "no-store" });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const rows =
          payload && typeof payload === "object"
            ? (payload as { recovery_adjustments?: unknown })
                .recovery_adjustments
            : null;
        if (!Array.isArray(rows)) return;

        const activePeriod = (rows as RecoveryAdjustment[])
          .map((adjustment) => periodForDomain(adjustment, domain))
          .find((candidate) => dayIsInRecoveryPeriod(today, candidate));

        if (!cancelled) setPeriod(activePeriod || null);
      } catch {
        // The log remains usable if recovery status cannot be loaded.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domain, targetUserId, today]);

  if (!period) return null;

  const detail =
    domain === "nutrition"
      ? "Today is excluded from nutrition adherence. Your entries and totals stay unchanged."
      : period.ends_on === today
        ? "Strength adherence is paused today. Your training history stays unchanged."
        : `Strength adherence is paused through ${readableDay(period.ends_on)}. Your training history stays unchanged.`;
  const planHref = targetUserId
    ? `/lifeswitch/plan?target_user_id=${encodeURIComponent(targetUserId)}`
    : "/lifeswitch/plan";

  return (
    <details className="mt-3 w-fit max-w-full rounded-lg border bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground select-none">
        Recovery adjustment applied
      </summary>
      <div className="mt-2 max-w-md pb-1 leading-relaxed">
        {detail}{" "}
        <Link
          className="font-medium text-foreground underline underline-offset-2"
          href={planHref}
        >
          View in Plan
        </Link>
      </div>
    </details>
  );
}
