"use client";

import {
  RESPONSE_TRACE_VERSION,
  responseInspectionFromTrace,
  responseTraceV2FromValue,
  type ResponseTrace as ResponseTracePayload,
  type ResponseTraceV2,
} from "@/lib/responseTraceV2";

export type ResponseInspection = ResponseTracePayload;

export function decodeResponseInspectionHeader(
  value: string | null,
  status: string | null,
): {
  inspect: ResponseTracePayload | null;
  inspect_error: string | null;
} {
  if (!value) {
    return {
      inspect: null,
      inspect_error:
        status === "unavailable" ? "Response trace was unavailable." : null,
    };
  }
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const parsed = responseTraceV2FromValue(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (!parsed) throw new Error("unsupported contract");
    return { inspect: parsed, inspect_error: null };
  } catch {
    return { inspect: null, inspect_error: "Response trace was unavailable." };
  }
}

type ResponseTraceProps = {
  inspection: ResponseTracePayload | null;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function responsePathLabel(trace: ResponseTraceV2): string {
  if (trace.authorities.response_runtime === "current_news_v1") {
    return "Current news";
  }
  if (trace.authorities.response_runtime === "trusted_web_v1") {
    return "Trusted health";
  }
  return "Ordinary";
}

function verificationLabel(value: string): string {
  return value === "supabase_fresh_user_lookup"
    ? "fresh user lookup"
    : "signed JWT";
}

function timingRows(trace: ResponseTraceV2): Array<[string, number]> {
  if (!trace.timings) return [];
  const rows: Array<[string, number | undefined]> = [
    ["Total", trace.timings.backend_total_ms],
    ["Classification", trace.timings.signal_classification_ms],
    ["Memory", trace.timings.memory_selection_ms],
    ["Orchestration", trace.timings.orchestration_ms],
    ["Generation", trace.timings.answer_generation_ms],
    ["Persistence", trace.timings.persistence_ms],
  ];
  return rows.filter((row): row is [string, number] => Number.isFinite(row[1]));
}

export function ResponseTrace({
  inspection,
  error,
  copied,
  onCopy,
}: ResponseTraceProps) {
  const traceV2 =
    inspection?.contract_version === RESPONSE_TRACE_VERSION ? inspection : null;
  const backend = responseInspectionFromTrace(inspection);
  const before = backend?.before_openai;
  const timings = traceV2 ? timingRows(traceV2) : [];

  return (
    <details className="mt-2 max-w-[42rem] rounded-xl border bg-background/30 p-3 text-xs">
      <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase select-none">
        Response trace
        {traceV2
          ? ` · ${responsePathLabel(traceV2)} · web ${
              traceV2.routing.executed_external_web_access ? "used" : "not used"
            }`
          : before
            ? ` · ${before.response_mode} · FM ${before.fm_record_count} · memory ${before.memory_record_count}`
            : ""}
        {traceV2?.request.channel === "voice" ||
        backend?.delivery?.channel === "voice"
          ? " · voice"
          : ""}
      </summary>

      {error && (
        <div className="mt-2 rounded-md border bg-muted/30 p-2">
          <div className="font-semibold">Trace unavailable</div>
          <div className="mt-1 break-words whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {inspection && (
        <div className="mt-3 space-y-3">
          <div className="flex justify-end">
            <button
              className={[
                "rounded-md border bg-background px-2 py-1 text-[11px]",
                copied ? "ring-1 ring-ring" : "",
              ].join(" ")}
              onClick={onCopy}
            >
              {copied ? "Copied" : "Copy safe trace"}
            </button>
          </div>

          {traceV2 && (
            <>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="font-semibold">Decision and execution</div>
                <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Channel</span>
                  <span>{titleCase(traceV2.request.channel)}</span>
                  <span className="text-muted-foreground">Response path</span>
                  <span>{responsePathLabel(traceV2)}</span>
                  <span className="text-muted-foreground">Search</span>
                  <span>
                    {titleCase(traceV2.routing.decision)}
                    {traceV2.routing.reason_codes.length > 0
                      ? ` · ${traceV2.routing.reason_codes
                          .map(titleCase)
                          .join(", ")}`
                      : ""}
                  </span>
                  <span className="text-muted-foreground">Route</span>
                  <span>{titleCase(traceV2.routing.selected_route)}</span>
                  <span className="text-muted-foreground">Web access</span>
                  <span>
                    {traceV2.routing.executed_external_web_access
                      ? "Used"
                      : "Not used"}
                  </span>
                  <span className="text-muted-foreground">Policy</span>
                  <span>
                    {traceV2.routing.policy_version} ·{" "}
                    {titleCase(traceV2.routing.policy_pack)}
                  </span>
                  <span className="text-muted-foreground">Storage</span>
                  <span>
                    {traceV2.request.transcript_persistence === "persisted"
                      ? "Persisted"
                      : "Not persisted"}
                  </span>
                  {traceV2.routing.fallback_to_chat && (
                    <>
                      <span className="text-muted-foreground">Fallback</span>
                      <span>
                        {traceV2.routing.attempted_route
                          ? `${titleCase(
                              traceV2.routing.attempted_route,
                            )} to ordinary chat`
                          : "Ordinary chat"}
                      </span>
                    </>
                  )}
                  {traceV2.execution.web_searched && (
                    <>
                      <span className="text-muted-foreground">Sources</span>
                      <span>{traceV2.execution.source_count}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-2">
                <div className="font-semibold">Authorization</div>
                <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Identity</span>
                  <span>
                    Supabase ·{" "}
                    {verificationLabel(
                      traceV2.authorization.actor_verification,
                    )}
                  </span>
                  <span className="text-muted-foreground">Execution</span>
                  <span>{traceV2.authorization.execution_authorization}</span>
                  <span className="text-muted-foreground">Inspector</span>
                  <span>
                    {traceV2.authorization.inspection_capability} · fresh user
                    lookup
                  </span>
                </div>
              </div>

              {timings.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="font-semibold">Timing</div>
                  <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                    {timings.map(([label, milliseconds]) => (
                      <div className="contents" key={label}>
                        <span className="text-muted-foreground">{label}</span>
                        <span>{milliseconds} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {backend?.delivery?.channel === "voice" && (
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="font-semibold">Voice delivery</div>
              <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Channel</span>
                <span>Governed voice</span>
              </div>
            </div>
          )}

          {backend && (
            <>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="font-semibold">Before OpenAI</div>
                <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Mode</span>
                  <span>{backend.before_openai.response_mode}</span>
                  <span className="text-muted-foreground">Safety</span>
                  <span>
                    {backend.before_openai.high_stakes_gate === "pass"
                      ? "standard"
                      : backend.before_openai.high_stakes_gate}
                  </span>
                  <span className="text-muted-foreground">FM</span>
                  <span>
                    {backend.before_openai.fm_level} ·{" "}
                    {backend.before_openai.fm_record_count} records ·{" "}
                    {backend.before_openai.fm_estimated_tokens} estimated tokens
                  </span>
                  <span className="text-muted-foreground">Memory</span>
                  <span>
                    {backend.before_openai.memory_included
                      ? `${backend.before_openai.memory_record_count} records · ${backend.before_openai.memory_estimated_tokens} estimated tokens`
                      : "not included"}
                  </span>
                  <span className="text-muted-foreground">Input</span>
                  <span>
                    {backend.before_openai.total_message_count} messages ·{" "}
                    {backend.before_openai.estimated_input_tokens} estimated
                    tokens
                  </span>
                </div>
                {backend.before_openai.fm_selected_record_ids.length > 0 && (
                  <div className="mt-2 break-words text-muted-foreground">
                    FM records:{" "}
                    {backend.before_openai.fm_selected_record_ids.join(", ")}
                  </div>
                )}
                {backend.before_openai.safety_reason_codes.length > 0 && (
                  <div className="mt-2 break-words text-muted-foreground">
                    Safety reasons:{" "}
                    {backend.before_openai.safety_reason_codes.join(", ")}
                  </div>
                )}
              </div>

              <div className="rounded-md border bg-muted/30 p-2">
                <div className="font-semibold">OpenAI</div>
                <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Model</span>
                  <span>{backend.openai.returned_model}</span>
                  <span className="text-muted-foreground">Tokens</span>
                  <span>
                    {backend.openai.input_tokens} in ·{" "}
                    {backend.openai.output_tokens} out ·{" "}
                    {backend.openai.total_tokens} total
                  </span>
                  <span className="text-muted-foreground">Finish</span>
                  <span>{backend.openai.finish_reason}</span>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-2">
                <div className="font-semibold">After OpenAI</div>
                <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Validation</span>
                  <span>{backend.after_openai.validation}</span>
                  <span className="text-muted-foreground">Answer</span>
                  <span>{backend.after_openai.answer_binding}</span>
                  <span className="text-muted-foreground">Transcript</span>
                  <span>{backend.after_openai.transcript_persistence}</span>
                  <span className="text-muted-foreground">Memory binding</span>
                  <span>{backend.after_openai.memory_binding}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
}
