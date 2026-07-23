"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import type {
  AdminVoiceHealth,
  VoiceHealthCheckKey,
  VoiceHealthStatus,
} from "@/lib/adminVoiceHealth";

const CHECK_ROWS: Array<{
  key: VoiceHealthCheckKey;
  label: string;
  format: "percent" | "duration";
}> = [
  {
    key: "turn_success_rate",
    label: "Successful voice turns",
    format: "percent",
  },
  {
    key: "transcription_ms_p95",
    label: "Transcription p95",
    format: "duration",
  },
  {
    key: "response_ms_p95",
    label: "Governed response p95",
    format: "duration",
  },
  {
    key: "tts_first_audio_ms_p95",
    label: "Speech start p95",
    format: "duration",
  },
  {
    key: "end_of_speech_to_first_audio_ms_p95",
    label: "End of speech to audio p95",
    format: "duration",
  },
];

function statusLabel(status: VoiceHealthStatus): string {
  if (status === "pass") return "Healthy";
  if (status === "fail") return "Needs attention";
  return "Collecting data";
}

function statusClass(status: VoiceHealthStatus): string {
  if (status === "pass") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "fail") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function metric(value: number | null, format: "percent" | "duration") {
  if (value === null) return "—";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

function timeLabel(value: string | null): string {
  if (!value) return "No sample yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function VoiceSystemHealthPanel() {
  const [health, setHealth] = React.useState<AdminVoiceHealth | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/voice-health", {
        method: "GET",
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        throw new Error("Voice health is temporarily unavailable.");
      }
      setHealth(body as AdminVoiceHealth);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Voice health is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Voice System Health</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Governed voice reliability and latency from the hourly synthetic
            check.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {health ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(health.status)}`}
            >
              {statusLabel(health.status)}
            </span>
            <span className="text-xs text-muted-foreground">
              {health.sample.completed} of {health.sample.evaluated_turns}{" "}
              evaluated turns succeeded
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="divide-y">
              {CHECK_ROWS.map((row) => {
                const check = health.checks[row.key];
                return (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium">{row.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Target {check.operator}{" "}
                        {metric(check.target, row.format)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {metric(check.actual, row.format)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${statusClass(check.status)}`}
                      >
                        {check.status === "pass"
                          ? "Pass"
                          : check.status === "fail"
                            ? "Fail"
                            : "Pending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border p-2">
              <div className="font-medium">Latest canary sample</div>
              <div className="mt-0.5 text-muted-foreground">
                {timeLabel(health.latest_sample_at)}
              </div>
            </div>
            <div className="rounded-lg border p-2">
              <div className="font-medium">Freshness</div>
              <div className="mt-0.5 text-muted-foreground">
                {health.freshness.age_minutes === null
                  ? "Waiting for data"
                  : `${health.freshness.age_minutes} minutes old`}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground">
            Rolling {health.window_days}-day window · minimum{" "}
            {health.minimum_samples} evaluated turns · automatically refreshes
            every minute
          </div>
        </div>
      ) : null}
    </div>
  );
}
