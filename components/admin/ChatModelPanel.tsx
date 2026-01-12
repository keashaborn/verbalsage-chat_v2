"use client";

import * as React from "react";
import { useSettingsStore } from "@/components/admin/settings/store";

function normalizeModel(model: string): string {
  const v = String(model || "").trim().slice(0, 64);
  return v || "gpt-5.2";
}

function Group({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
      {footer != null && <div className="px-1 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Row({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

export function ChatModelPanel() {
  const { applied, draft, applyModelNow } = useSettingsStore();
  const model = normalizeModel(draft.model || applied.model || "gpt-5.2");

  return (
    <div className="space-y-4">
      <Group
        title="Chat model"
        footer={
          <>
            Applies immediately (next message). Stored in cookie <code>vs_model</code>.
          </>
        }
      >
        <Row
          left="Model"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={model}
              onChange={(e) => applyModelNow(normalizeModel(e.target.value))}
            >
              <optgroup label="OpenAI">
                <option value="gpt-5.2">gpt-5.2</option>
                <option value="gpt-5.1">gpt-5.1</option>
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
              </optgroup>

              <optgroup label="xAI (Grok)">
                <option value="xai:grok-3">xai:grok-3</option>
                <option value="xai:grok-3-mini">xai:grok-3-mini</option>
                <option value="xai:grok-4-0709">xai:grok-4-0709</option>
                <option value="xai:grok-4-1-fast-non-reasoning">xai:grok-4-1-fast-non-reasoning</option>
                <option value="xai:grok-4-1-fast-reasoning">xai:grok-4-1-fast-reasoning</option>
                <option value="xai:grok-4-fast-non-reasoning">xai:grok-4-fast-non-reasoning</option>
                <option value="xai:grok-4-fast-reasoning">xai:grok-4-fast-reasoning</option>
                <option value="xai:grok-code-fast-1">xai:grok-code-fast-1</option>
                <option value="xai:grok-2-vision-1212">xai:grok-2-vision-1212</option>
                <option value="xai:grok-2-image-1212">xai:grok-2-image-1212</option>
              </optgroup>
            </select>
          }
        />
      </Group>
    </div>
  );
}
