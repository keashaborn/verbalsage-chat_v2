"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import {
  CONVERSATION_STYLE_OPTIONS,
  normalizeConversationStyle,
  storeConversationStyle,
  type ConversationStyle,
} from "@/lib/conversationStyle";

type CompilationState = {
  status: "active" | "none";
  summary: string[];
  not_applied: string[];
  compiled_at: string | null;
};

type FormState = {
  revision: number;
  assistant_name: string;
  nickname: string;
  occupation: string;
  more_about_you: string;
  custom_instructions: string;
  response_length: "concise" | "balanced" | "detailed";
  technical_depth: "plain" | "balanced" | "expert";
  format: "auto" | "prose" | "bullets" | "steps";
  conversation_style: ConversationStyle;
  compilation: CompilationState;
};

type CompilationCandidate = {
  candidate_id: string;
  source_revision: number;
  status: "accepted" | "partial" | "rejected" | "clear";
  summary: string[];
  not_applied: string[];
  proposed: {
    response_length: FormState["response_length"] | null;
    technical_depth: FormState["technical_depth"] | null;
    format: FormState["format"] | null;
    conversation_style: ConversationStyle | null;
  };
  expires_at: string | null;
};

const EMPTY_COMPILATION: CompilationState = {
  status: "none",
  summary: [],
  not_applied: [],
  compiled_at: null,
};

const MAX_PREFERENCE_NARRATIVE_CHARS = 8000;
const PREFERENCE_AUTHORITY_NOTE =
  "Response preferences cannot control tools, memory ownership, retrieval, safety, or system policy.";

const RESPONSE_LENGTH_OPTIONS: ReadonlyArray<{
  value: FormState["response_length"];
}> = [{ value: "concise" }, { value: "balanced" }, { value: "detailed" }];

const EMPTY: FormState = {
  revision: 0,
  assistant_name: "",
  nickname: "",
  occupation: "",
  more_about_you: "",
  custom_instructions: "",
  response_length: "balanced",
  technical_depth: "balanced",
  format: "auto",
  conversation_style: "natural",
  compilation: EMPTY_COMPILATION,
};

function editableSignature(value: FormState): string {
  return JSON.stringify({
    assistant_name: value.assistant_name,
    nickname: value.nickname,
    occupation: value.occupation,
    more_about_you: value.more_about_you,
    custom_instructions: value.custom_instructions,
    response_length: value.response_length,
    technical_depth: value.technical_depth,
    format: value.format,
    conversation_style: value.conversation_style,
  });
}

function normalizedForm(value: any): FormState {
  const conversationStyle = storeConversationStyle(value?.conversation_style);
  return {
    ...EMPTY,
    ...value,
    conversation_style: conversationStyle,
    compilation: {
      ...EMPTY_COMPILATION,
      ...(value?.compilation || {}),
      summary: Array.isArray(value?.compilation?.summary)
        ? value.compilation.summary.map(String)
        : [],
      not_applied: Array.isArray(value?.compilation?.not_applied)
        ? value.compilation.not_applied.map(String)
        : [],
    },
  };
}

function TextField({
  label,
  description,
  placeholder,
  maxLength,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {description ? (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      <input
        className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  description,
  placeholder,
  maxLength,
  value,
  onChange,
  rows,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {description ? (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed"
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {description ? (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      ) : null}
      <select
        className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option
              .replaceAll("_", " ")
              .replace(/\b\w/g, (character) => character.toUpperCase())}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AssistantPreferences() {
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [savedSignature, setSavedSignature] = React.useState(
    editableSignature(EMPTY),
  );
  const [instructionDraft, setInstructionDraft] = React.useState("");
  const [candidate, setCandidate] = React.useState<CompilationCandidate | null>(
    null,
  );
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const hasUnsavedFormChanges = editableSignature(form) !== savedSignature;

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await authFetch("/api/user/assistant-preferences", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load preferences.");
        const value = normalizedForm(await response.json());
        setForm(value);
        setSavedSignature(editableSignature(value));
        setInstructionDraft(value.custom_instructions);
      } catch (error: any) {
        setStatus(error?.message || "Could not load preferences.");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setStatus("");
    setCandidate(null);
    try {
      const conversationStyle = normalizeConversationStyle(
        form.conversation_style,
      );
      const response = await authFetch("/api/user/assistant-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expected_revision: form.revision,
          conversation_style: conversationStyle,
        }),
      });
      if (response.status === 409) {
        throw new Error(
          "These preferences changed on another device. Reload before saving.",
        );
      }
      if (!response.ok) throw new Error("Could not save preferences.");
      const value = normalizedForm(await response.json());
      setForm(value);
      setSavedSignature(editableSignature(value));
      setInstructionDraft(value.custom_instructions);
      storeConversationStyle(conversationStyle);
      setStatus("Saved.");
    } catch (error: any) {
      setStatus(error?.message || "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewInstructions() {
    if (hasUnsavedFormChanges) {
      setStatus("Save the other changes before reviewing these preferences.");
      return;
    }
    setReviewing(true);
    setStatus("");
    setCandidate(null);
    try {
      const response = await authFetch(
        "/api/user/assistant-preferences/compile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_revision: form.revision,
            narrative: instructionDraft,
          }),
        },
      );
      if (response.status === 409) {
        throw new Error(
          "These preferences changed on another device. Reload before reviewing.",
        );
      }
      if (!response.ok) {
        throw new Error("Could not review these preferences right now.");
      }
      setCandidate((await response.json()) as CompilationCandidate);
    } catch (error: any) {
      setStatus(error?.message || "Could not review these preferences.");
    } finally {
      setReviewing(false);
    }
  }

  async function applyCandidate() {
    if (!candidate) return;
    setApplying(true);
    setStatus("");
    try {
      const response = await authFetch(
        "/api/user/assistant-preferences/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_revision: candidate.source_revision,
            candidate_id: candidate.candidate_id,
          }),
        },
      );
      if (response.status === 409) {
        throw new Error(
          "This review is no longer current. Review the preferences again.",
        );
      }
      if (!response.ok) throw new Error("Could not apply these preferences.");
      const value = normalizedForm(await response.json());
      setForm(value);
      setSavedSignature(editableSignature(value));
      setInstructionDraft(value.custom_instructions);
      storeConversationStyle(value.conversation_style);
      setCandidate(null);
      setStatus("Preferences applied.");
    } catch (error: any) {
      setStatus(error?.message || "Could not apply these preferences.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="space-y-5" aria-labelledby="about-you-title">
        <h2 id="about-you-title" className="text-base font-semibold">
          You
        </h2>
        <TextField
          label="Assistant name"
          placeholder="Enter a name"
          maxLength={40}
          value={form.assistant_name}
          onChange={(assistant_name) =>
            setForm((state) => ({ ...state, assistant_name }))
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Your nickname"
            value={form.nickname}
            onChange={(nickname) =>
              setForm((state) => ({ ...state, nickname }))
            }
          />
          <TextField
            label="Your occupation"
            value={form.occupation}
            onChange={(occupation) =>
              setForm((state) => ({ ...state, occupation }))
            }
          />
        </div>
        <TextArea
          label="More about you"
          rows={4}
          maxLength={2000}
          value={form.more_about_you}
          onChange={(more_about_you) =>
            setForm((state) => ({ ...state, more_about_you }))
          }
        />
      </section>

      <section
        className="space-y-5 border-t border-muted/20 pt-7"
        aria-labelledby="response-preferences-title"
      >
        <div>
          <h2
            id="response-preferences-title"
            className="text-base font-semibold"
          >
            Responses
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Conversation style"
            value={form.conversation_style}
            options={CONVERSATION_STYLE_OPTIONS.map((option) => option.value)}
            onChange={(conversation_style) =>
              setForm((state) => ({
                ...state,
                conversation_style:
                  normalizeConversationStyle(conversation_style),
              }))
            }
          />
          <SelectField
            label="Response length"
            value={form.response_length}
            options={RESPONSE_LENGTH_OPTIONS.map((option) => option.value)}
            onChange={(response_length) =>
              setForm((state) => ({
                ...state,
                response_length:
                  response_length as FormState["response_length"],
              }))
            }
          />
        </div>
      </section>

      <details className="group border-t border-muted/20 pt-7">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-semibold [&::-webkit-details-marker]:hidden">
          <span>Advanced</span>
          <span
            className="text-xl text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ›
          </span>
        </summary>

        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Technical depth"
              value={form.technical_depth}
              options={["plain", "balanced", "expert"]}
              onChange={(technical_depth) =>
                setForm((state) => ({
                  ...state,
                  technical_depth:
                    technical_depth as FormState["technical_depth"],
                }))
              }
            />
            <SelectField
              label="Format"
              value={form.format}
              options={["auto", "prose", "bullets", "steps"]}
              onChange={(format) =>
                setForm((state) => ({
                  ...state,
                  format: format as FormState["format"],
                }))
              }
            />
          </div>

          {!candidate ? (
            <div className="space-y-4">
              <TextArea
                label="Your preferences"
                placeholder="Describe what would make responses work better for you."
                rows={8}
                maxLength={MAX_PREFERENCE_NARRATIVE_CHARS}
                value={instructionDraft}
                onChange={(value) => {
                  setInstructionDraft(value);
                  setStatus("");
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {instructionDraft.length}/{MAX_PREFERENCE_NARRATIVE_CHARS}
                </span>
                <button
                  type="button"
                  disabled={!ready || reviewing || hasUnsavedFormChanges}
                  onClick={() => void reviewInstructions()}
                  className="min-h-11 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted/40 disabled:opacity-40"
                >
                  {reviewing ? "Reviewing…" : "Review preferences"}
                </button>
              </div>
              {hasUnsavedFormChanges ? (
                <p className="text-xs text-muted-foreground">
                  Save the other page changes before requesting a review.
                </p>
              ) : null}
              {form.compilation.status === "active" &&
              form.compilation.summary.length ? (
                <div className="space-y-2 border-t border-muted/20 pt-4">
                  <h3 className="text-sm font-semibold">Currently applied</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {form.compilation.summary.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">What will change</h3>
                {candidate.summary.length ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {candidate.summary.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No supported response changes were identified.
                  </p>
                )}
              </div>
              {candidate.not_applied.length ? (
                <div className="space-y-2 border-t border-muted/20 pt-4">
                  <h3 className="text-sm font-semibold">Not applied</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {candidate.not_applied.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {PREFERENCE_AUTHORITY_NOTE}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nothing changes until you apply this review.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => setCandidate(null)}
                  className="min-h-11 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted/40 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={applying || candidate.status === "rejected"}
                  onClick={() => void applyCandidate()}
                  className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  {applying ? "Applying…" : "Apply preferences"}
                </button>
              </div>
            </div>
          )}
        </div>
      </details>

      <section className="border-t border-muted/20 pt-7">
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">{status}</span>
          <button
            type="button"
            className="min-h-11 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            disabled={!ready || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
