import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminVoiceHealth,
  VOICE_HEALTH_MAX_AGE_MINUTES,
} from "../lib/adminVoiceHealth.ts";

function source(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: "voice_slo_v1",
    overall_status: "pass",
    latest_sample_at: "2026-07-23T12:00:00Z",
    window_days: 30,
    minimum_samples: 30,
    sample: {
      total: 30,
      evaluated_turns: 30,
      completed: 30,
      failed: 0,
      cancelled: 0,
    },
    checks: {
      turn_success_rate: {
        actual: 1,
        target: 0.99,
        operator: ">=",
        status: "pass",
      },
      transcription_ms_p95: {
        actual: 2664.75,
        target: 3000,
        operator: "<=",
        status: "pass",
      },
      response_ms_p95: {
        actual: 6222.6,
        target: 10000,
        operator: "<=",
        status: "pass",
      },
      tts_first_audio_ms_p95: {
        actual: 729.8,
        target: 3000,
        operator: "<=",
        status: "pass",
      },
      end_of_speech_to_first_audio_ms_p95: {
        actual: 8451.95,
        target: 15000,
        operator: "<=",
        status: "pass",
      },
    },
    ...overrides,
  };
}

test("returns healthy only when SLO and sample freshness pass", () => {
  const result = buildAdminVoiceHealth(
    source(),
    Date.parse("2026-07-23T13:00:00Z"),
  );

  assert.equal(result.status, "pass");
  assert.equal(result.freshness.status, "pass");
  assert.equal(result.freshness.age_minutes, 60);
  assert.equal(result.sample.completed, 30);
});

test("marks a passing historical SLO unhealthy when the canary is stale", () => {
  const result = buildAdminVoiceHealth(
    source(),
    Date.parse("2026-07-23T16:00:01Z"),
  );

  assert.equal(result.status, "fail");
  assert.equal(result.freshness.status, "fail");
  assert.ok(
    (result.freshness.age_minutes || 0) > VOICE_HEALTH_MAX_AGE_MINUTES,
  );
});

test("rejects unrecognized upstream contracts", () => {
  assert.throws(
    () =>
      buildAdminVoiceHealth(
        source({ contract_version: "unexpected" }),
        Date.parse("2026-07-23T13:00:00Z"),
      ),
    /unsupported voice health contract/,
  );
});
