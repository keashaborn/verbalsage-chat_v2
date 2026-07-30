"use client";

import { useSearchParams } from "next/navigation";
import * as React from "react";

import { useConfirmAction } from "@/components/lifeswitch/ConfirmActionProvider";
import { authFetch } from "@/lib/authFetch";
import {
  reasonLabel,
  type RecoveryAdjustment,
  type RecoveryPeriod,
} from "@/lib/lifeswitch/recoveryAdjustments";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addLocalDays(day: string, count: number): string {
  const parsed = new Date(`${day}T12:00:00`);
  parsed.setDate(parsed.getDate() + count);
  return localDay(parsed);
}

function readableDay(day: string): string {
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function periodLabel(period: RecoveryPeriod | null): string {
  if (!period) return "";
  return period.starts_on === period.ends_on
    ? readableDay(period.starts_on)
    : `${readableDay(period.starts_on)} – ${readableDay(period.ends_on)}`;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function RecoveryAdjustmentCard() {
  const confirmAction = useConfirmAction();
  const searchParams = useSearchParams();
  const targetUserId = String(searchParams.get("target_user_id") || "").trim();
  const delegated = Boolean(targetUserId);
  const today = React.useMemo(() => localDay(), []);
  const [adjustments, setAdjustments] = React.useState<RecoveryAdjustment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [reasonCode, setReasonCode] = React.useState("surgery_recovery");
  const [note, setNote] = React.useState("");
  const [nutritionEnabled, setNutritionEnabled] = React.useState(true);
  const [nutritionStartsOn, setNutritionStartsOn] = React.useState(today);
  const [nutritionEndsOn, setNutritionEndsOn] = React.useState(today);
  const [strengthEnabled, setStrengthEnabled] = React.useState(true);
  const [strengthStartsOn, setStrengthStartsOn] = React.useState(today);
  const [strengthEndsOn, setStrengthEndsOn] = React.useState(
    addLocalDays(today, 13),
  );

  const apiUrl = React.useCallback(
    (path: string) => {
      const url = new URL(
        `/api/lifeswitch/plan/agentic/${path}`,
        window.location.origin,
      );
      if (targetUserId) url.searchParams.set("target_user_id", targetUserId);
      return url;
    },
    [targetUserId],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = apiUrl("recovery-adjustments");
      url.searchParams.set("starts_on", today);
      url.searchParams.set("ends_on", today);
      const response = await authFetch(url.toString(), { cache: "no-store" });
      const text = await response.text();
      const payload: unknown = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "Recovery adjustments are unavailable."),
        );
      }
      const rows =
        payload && typeof payload === "object"
          ? (payload as { recovery_adjustments?: unknown }).recovery_adjustments
          : null;
      setAdjustments(Array.isArray(rows) ? (rows as RecoveryAdjustment[]) : []);
    } catch (caught) {
      setAdjustments([]);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, today]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!nutritionEnabled && !strengthEnabled) {
      setError("Select nutrition, strength, or both.");
      return;
    }
    if (
      (nutritionEnabled && nutritionEndsOn < nutritionStartsOn) ||
      (strengthEnabled && strengthEndsOn < strengthStartsOn)
    ) {
      setError("An end date cannot be before its start date.");
      return;
    }
    setPending("save");
    setError("");
    setMessage("");
    try {
      const response = await authFetch(apiUrl("recovery-adjustments").toString(), {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-lifeswitch-owner-timezone":
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        body: JSON.stringify({
          reason_code: reasonCode,
          note,
          nutrition_period: nutritionEnabled
            ? { starts_on: nutritionStartsOn, ends_on: nutritionEndsOn }
            : null,
          strength_period: strengthEnabled
            ? { starts_on: strengthStartsOn, ends_on: strengthEndsOn }
            : null,
        }),
      });
      const text = await response.text();
      const payload: unknown = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "The recovery adjustment could not be saved."),
        );
      }
      setEditing(false);
      setMessage("Recovery adjustment saved. Your underlying Plan is unchanged.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending("");
    }
  }

  async function stop(adjustmentId: string) {
    const confirmed = await confirmAction({
      title: "End this recovery adjustment today?",
      description: "Past adjusted days remain in history.",
      confirmLabel: "End adjustment",
    });
    if (!confirmed) return;
    setPending(adjustmentId);
    setError("");
    setMessage("");
    try {
      const response = await authFetch(
        apiUrl(`recovery-adjustments/${adjustmentId}/stop`).toString(),
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "idempotency-key": crypto.randomUUID(),
            "x-lifeswitch-owner-timezone":
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
        },
      );
      const text = await response.text();
      const payload: unknown = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "The recovery adjustment could not be ended."),
        );
      }
      setMessage("Recovery adjustment ended. Past adjusted days remain recorded.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending("");
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
      <div className="border-t border-border/50 bg-background pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Recovery adjustment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Temporarily adjust adherence without rewriting your Plan or
              changing logged totals.
            </p>
          </div>
          {!delegated && !adjustments.length && !loading ? (
            <button
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              type="button"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? "Cancel" : "Add adjustment"}
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm"
          >
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>
        ) : null}

        {!loading && adjustments.length ? (
          <div className="mt-4 divide-y divide-border/50 border-y border-border/50">
            {adjustments.map((adjustment) => (
              <div
                key={adjustment.adjustment_id}
                className="py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {reasonLabel(adjustment.reason_code)}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      {adjustment.nutrition_period ? (
                        <div>
                          Nutrition adherence excused:{" "}
                          {periodLabel(adjustment.nutrition_period)}
                        </div>
                      ) : null}
                      {adjustment.strength_period ? (
                        <div>
                          Heavy-strength evaluation paused:{" "}
                          {periodLabel(adjustment.strength_period)}
                        </div>
                      ) : null}
                      {adjustment.note ? (
                        <div className="mt-1">Private note: {adjustment.note}</div>
                      ) : null}
                    </div>
                  </div>
                  {!delegated ? (
                    <button
                      className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => void stop(adjustment.adjustment_id)}
                    >
                      {pending === adjustment.adjustment_id
                        ? "Ending…"
                        : "End early"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !adjustments.length && !editing && !error ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No recovery adjustment is active today.
          </p>
        ) : null}

        {editing && !delegated ? (
          <div className="mt-4 grid gap-4 rounded-xl border p-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Reason</span>
              <select
                className="rounded-xl border bg-background px-3 py-2"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              >
                <option value="surgery_recovery">Surgery recovery</option>
                <option value="illness">Illness</option>
                <option value="injury">Injury</option>
                <option value="other">Other recovery</option>
              </select>
            </label>

            <div className="rounded-xl border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={nutritionEnabled}
                  onChange={(event) => setNutritionEnabled(event.target.checked)}
                />
                Excuse nutrition adherence
              </label>
              {nutritionEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span>From</span>
                    <input
                      className="rounded-xl border bg-background px-3 py-2"
                      type="date"
                      value={nutritionStartsOn}
                      onChange={(event) =>
                        setNutritionStartsOn(event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Through</span>
                    <input
                      className="rounded-xl border bg-background px-3 py-2"
                      type="date"
                      value={nutritionEndsOn}
                      onChange={(event) => setNutritionEndsOn(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={strengthEnabled}
                  onChange={(event) => setStrengthEnabled(event.target.checked)}
                />
                Pause heavy-strength evaluation
              </label>
              {strengthEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span>From</span>
                    <input
                      className="rounded-xl border bg-background px-3 py-2"
                      type="date"
                      value={strengthStartsOn}
                      onChange={(event) =>
                        setStrengthStartsOn(event.target.value)
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Through</span>
                    <input
                      className="rounded-xl border bg-background px-3 py-2"
                      type="date"
                      value={strengthEndsOn}
                      onChange={(event) => setStrengthEndsOn(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Private note (optional)</span>
              <textarea
                className="min-h-20 rounded-xl border bg-background px-3 py-2"
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="For your context only"
              />
            </label>

            <div>
              <button
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void save()}
              >
                {pending === "save" ? "Saving…" : "Save recovery adjustment"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
