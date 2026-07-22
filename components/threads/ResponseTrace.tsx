"use client";

export type ResponseInspection = {
  contract_version: "response_inspection_v1";
  delivery?: {
    channel: "voice";
    voice_turn_id: string;
  } | null;
  before_openai: {
    response_mode: string;
    closure: string;
    high_stakes_gate: string;
    safety_action_required: boolean;
    safety_reason_codes: string[];
    mode_reason_codes: string[];
    fm_level: string;
    fm_status: string;
    fm_record_count: number;
    fm_selected_record_ids: string[];
    fm_estimated_tokens: number;
    memory_included: boolean;
    memory_record_count: number;
    memory_estimated_tokens: number;
    context_block_count: number;
    conversation_message_count: number;
    total_message_count: number;
    estimated_input_tokens: number;
    ignored_legacy_request_fields: string[];
  };
  openai: {
    response_id: string;
    requested_model: string;
    returned_model: string;
    finish_reason: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  after_openai: {
    answer_id: string;
    output_kind: string;
    validation: "passed";
    answer_binding: "bound";
    transcript_persistence: "persisted" | "skipped";
    memory_binding: "bound" | "none";
  };
};

export function decodeResponseInspectionHeader(
  value: string | null,
  status: string | null,
): {
  inspect: ResponseInspection | null;
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
    const parsed = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as ResponseInspection;
    if (parsed?.contract_version !== "response_inspection_v1") {
      throw new Error("unsupported contract");
    }
    return { inspect: parsed, inspect_error: null };
  } catch {
    return { inspect: null, inspect_error: "Response trace was unavailable." };
  }
}

type ResponseTraceProps = {
  inspection: ResponseInspection | null;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
};

export function ResponseTrace({
  inspection,
  error,
  copied,
  onCopy,
}: ResponseTraceProps) {
  const before = inspection?.before_openai;
  return (
    <details className="mt-2 max-w-[42rem] rounded-xl border bg-background/30 p-3 text-xs">
      <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase select-none">
        Response trace
        {before
          ? ` · ${before.response_mode} · FM ${before.fm_record_count} · memory ${before.memory_record_count}`
          : ""}
        {inspection?.delivery?.channel === "voice" ? " · voice" : ""}
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
              {copied ? "Copied" : "Copy trace"}
            </button>
          </div>

          {inspection.delivery?.channel === "voice" && (
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="font-semibold">Voice delivery</div>
              <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Channel</span>
                <span>governed voice</span>
                <span className="text-muted-foreground">Voice turn</span>
                <span className="font-mono text-[11px] break-all">
                  {inspection.delivery.voice_turn_id}
                </span>
              </div>
            </div>
          )}

          <div className="rounded-md border bg-muted/30 p-2">
            <div className="font-semibold">Before OpenAI</div>
            <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Mode</span>
              <span>{inspection.before_openai.response_mode}</span>
              <span className="text-muted-foreground">Safety</span>
              <span>
                {inspection.before_openai.high_stakes_gate === "pass"
                  ? "standard"
                  : inspection.before_openai.high_stakes_gate}
              </span>
              <span className="text-muted-foreground">FM</span>
              <span>
                {inspection.before_openai.fm_level} ·{" "}
                {inspection.before_openai.fm_record_count} records ·{" "}
                {inspection.before_openai.fm_estimated_tokens} estimated tokens
              </span>
              <span className="text-muted-foreground">Memory</span>
              <span>
                {inspection.before_openai.memory_included
                  ? `${inspection.before_openai.memory_record_count} records · ${inspection.before_openai.memory_estimated_tokens} estimated tokens`
                  : "not included"}
              </span>
              <span className="text-muted-foreground">Input</span>
              <span>
                {inspection.before_openai.total_message_count} messages ·{" "}
                {inspection.before_openai.estimated_input_tokens} estimated
                tokens
              </span>
            </div>
            {inspection.before_openai.fm_selected_record_ids.length > 0 && (
              <div className="mt-2 break-words text-muted-foreground">
                FM records:{" "}
                {inspection.before_openai.fm_selected_record_ids.join(", ")}
              </div>
            )}
            {inspection.before_openai.safety_reason_codes.length > 0 && (
              <div className="mt-2 break-words text-muted-foreground">
                Safety reasons:{" "}
                {inspection.before_openai.safety_reason_codes.join(", ")}
              </div>
            )}
          </div>

          <div className="rounded-md border bg-muted/30 p-2">
            <div className="font-semibold">OpenAI</div>
            <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Model</span>
              <span>{inspection.openai.returned_model}</span>
              <span className="text-muted-foreground">Tokens</span>
              <span>
                {inspection.openai.input_tokens} in ·{" "}
                {inspection.openai.output_tokens} out ·{" "}
                {inspection.openai.total_tokens} total
              </span>
              <span className="text-muted-foreground">Finish</span>
              <span>{inspection.openai.finish_reason}</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-2">
            <div className="font-semibold">After OpenAI</div>
            <div className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Validation</span>
              <span>{inspection.after_openai.validation}</span>
              <span className="text-muted-foreground">Answer</span>
              <span>{inspection.after_openai.answer_binding}</span>
              <span className="text-muted-foreground">Transcript</span>
              <span>{inspection.after_openai.transcript_persistence}</span>
              <span className="text-muted-foreground">Memory binding</span>
              <span>{inspection.after_openai.memory_binding}</span>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
