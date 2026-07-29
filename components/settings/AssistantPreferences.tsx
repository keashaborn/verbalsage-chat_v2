"use client";

import * as React from "react";
import { authFetch } from "@/lib/authFetch";
import {
  CONVERSATION_STYLE_OPTIONS,
  normalizeConversationStyle,
  storeConversationStyle,
  type ConversationStyle,
} from "@/lib/conversationStyle";
import { supabase } from "@/lib/supabaseClient";

type FormState = {
  nickname: string;
  occupation: string;
  more_about_you: string;
  custom_instructions: string;
  response_length: "concise" | "balanced" | "detailed";
  technical_depth: "plain" | "balanced" | "expert";
  format: "auto" | "prose" | "bullets" | "steps";
  conversation_style: ConversationStyle;
};

const EMPTY: FormState = {
  nickname: "",
  occupation: "",
  more_about_you: "",
  custom_instructions: "",
  response_length: "balanced",
  technical_depth: "balanced",
  format: "auto",
  conversation_style: "natural",
};

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <textarea
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <select
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
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
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await authFetch("/api/user/instructions", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load preferences.");
        const value = await response.json();
        const conversationStyle = storeConversationStyle(
          value?.conversation_style,
        );
        setForm({
          ...EMPTY,
          ...value,
          conversation_style: conversationStyle,
        });
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
    try {
      const conversationStyle = normalizeConversationStyle(
        form.conversation_style,
      );
      const response = await authFetch("/api/user/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          conversation_style: conversationStyle,
        }),
      });
      if (!response.ok) throw new Error("Could not save preferences.");
      storeConversationStyle(conversationStyle);
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { vs_conversation_style: conversationStyle },
      });
      setStatus(
        metadataError
          ? "Preferences saved, but this browser could not sync the speaking style."
          : "Saved.",
      );
    } catch (error: any) {
      setStatus(error?.message || "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-5" aria-labelledby="about-you-title">
        <div>
          <h2 id="about-you-title" className="text-base font-semibold">
            About you
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Information the assistant can use when it is relevant.
          </p>
        </div>
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
          value={form.more_about_you}
          onChange={(more_about_you) =>
            setForm((state) => ({ ...state, more_about_you }))
          }
        />
        <TextArea
          label="Custom instructions"
          rows={4}
          value={form.custom_instructions}
          onChange={(custom_instructions) =>
            setForm((state) => ({ ...state, custom_instructions }))
          }
        />
      </section>

      <section
        className="space-y-5 border-t border-muted/20 pt-7"
        aria-labelledby="response-preferences-title"
      >
        <div>
          <h2 id="response-preferences-title" className="text-base font-semibold">
            Response preferences
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set the default level of detail, format, and conversational style.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Response length"
            value={form.response_length}
            options={["concise", "balanced", "detailed"]}
            onChange={(response_length) =>
              setForm((state) => ({
                ...state,
                response_length:
                  response_length as FormState["response_length"],
              }))
            }
          />
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
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">
          These preferences affect presentation, not judgment or safety.
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">{status}</span>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            disabled={!ready || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
