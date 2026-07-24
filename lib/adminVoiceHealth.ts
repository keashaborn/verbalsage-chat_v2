export const VOICE_HEALTH_MAX_AGE_MINUTES = 180;

export const VOICE_HEALTH_CHECK_KEYS = [
  "turn_success_rate",
  "transcription_ms_p95",
  "response_ms_p95",
  "tts_first_audio_ms_p95",
  "end_of_speech_to_first_audio_ms_p95",
] as const;

export type VoiceHealthStatus = "pass" | "fail" | "insufficient_data";
export type VoiceHealthCheckKey = (typeof VOICE_HEALTH_CHECK_KEYS)[number];

type VoiceHealthCheck = {
  actual: number | null;
  target: number;
  operator: ">=" | "<=";
  status: VoiceHealthStatus;
};

export type AdminVoiceHealth = {
  ok: true;
  status: VoiceHealthStatus;
  source_status: VoiceHealthStatus;
  current: {
    status: VoiceHealthStatus;
    consecutive_successes: number;
    latest_failure_at: string | null;
    latest_failure_stage: string | null;
    latest_failure_code: string | null;
  };
  checked_at: string;
  latest_sample_at: string | null;
  window_days: number;
  minimum_samples: number;
  freshness: {
    status: VoiceHealthStatus;
    age_minutes: number | null;
    maximum_age_minutes: number;
  };
  sample: {
    total: number;
    evaluated_turns: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  checks: Record<VoiceHealthCheckKey, VoiceHealthCheck>;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid voice health response");
  }
  return value as Record<string, unknown>;
}

function status(value: unknown): VoiceHealthStatus {
  if (
    value === "pass" ||
    value === "fail" ||
    value === "insufficient_data"
  ) {
    return value;
  }
  throw new Error("invalid voice health status");
}

function count(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error("invalid voice health count");
  }
  return Number(value);
}

function finiteNumber(value: unknown, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("invalid voice health metric");
  }
  return value;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`invalid ${label} timestamp`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid ${label} timestamp`);
  }
  return new Date(parsed).toISOString();
}

function nullableLabel(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error("invalid voice health failure label");
  }
  return value;
}

export function buildAdminVoiceHealth(
  raw: unknown,
  nowMs = Date.now(),
): AdminVoiceHealth {
  const source = record(raw);
  if (source.contract_version !== "voice_slo_v1") {
    throw new Error("unsupported voice health contract");
  }

  const sourceStatus = status(source.overall_status);
  const currentSource =
    source.current === undefined ? null : record(source.current);
  const currentStatus = currentSource
    ? status(currentSource.status)
    : sourceStatus;
  const current = {
    status: currentStatus,
    consecutive_successes: currentSource
      ? count(currentSource.consecutive_successes)
      : 0,
    latest_failure_at: currentSource
      ? nullableTimestamp(
          currentSource.latest_failure_at,
          "latest voice failure",
        )
      : null,
    latest_failure_stage: currentSource
      ? nullableLabel(currentSource.latest_failure_stage)
      : null,
    latest_failure_code: currentSource
      ? nullableLabel(currentSource.latest_failure_code)
      : null,
  };
  const sampleSource = record(source.sample);
  const checksSource = record(source.checks);
  const checks = {} as Record<VoiceHealthCheckKey, VoiceHealthCheck>;

  for (const key of VOICE_HEALTH_CHECK_KEYS) {
    const sourceCheck = record(checksSource[key]);
    const operator = sourceCheck.operator;
    if (operator !== ">=" && operator !== "<=") {
      throw new Error("invalid voice health operator");
    }
    checks[key] = {
      actual: finiteNumber(sourceCheck.actual, true),
      target: finiteNumber(sourceCheck.target) as number,
      operator,
      status: status(sourceCheck.status),
    };
  }

  let latestSampleAt: string | null = null;
  let ageMinutes: number | null = null;
  let freshnessStatus: VoiceHealthStatus = "insufficient_data";
  if (typeof source.latest_sample_at === "string") {
    const latestMs = Date.parse(source.latest_sample_at);
    if (!Number.isFinite(latestMs)) {
      throw new Error("invalid latest voice sample timestamp");
    }
    latestSampleAt = new Date(latestMs).toISOString();
    const rawAgeMinutes = (nowMs - latestMs) / 60_000;
    ageMinutes = Math.max(0, Math.round(rawAgeMinutes * 10) / 10);
    freshnessStatus =
      rawAgeMinutes >= -5 && rawAgeMinutes <= VOICE_HEALTH_MAX_AGE_MINUTES
        ? "pass"
        : "fail";
  } else if (source.latest_sample_at !== null) {
    throw new Error("invalid latest voice sample timestamp");
  }

  const overallStatus: VoiceHealthStatus =
    currentStatus === "fail" || freshnessStatus === "fail"
      ? "fail"
      : currentStatus === "insufficient_data" ||
          freshnessStatus === "insufficient_data"
        ? "insufficient_data"
        : "pass";

  return {
    ok: true,
    status: overallStatus,
    source_status: sourceStatus,
    current,
    checked_at: new Date(nowMs).toISOString(),
    latest_sample_at: latestSampleAt,
    window_days: count(source.window_days),
    minimum_samples: count(source.minimum_samples),
    freshness: {
      status: freshnessStatus,
      age_minutes: ageMinutes,
      maximum_age_minutes: VOICE_HEALTH_MAX_AGE_MINUTES,
    },
    sample: {
      total: count(sampleSource.total),
      evaluated_turns: count(sampleSource.evaluated_turns),
      completed: count(sampleSource.completed),
      failed: count(sampleSource.failed),
      cancelled: count(sampleSource.cancelled),
    },
    checks,
  };
}
