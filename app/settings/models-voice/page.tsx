"use client";

import { VoicePanel } from "@/components/admin/VoicePanel";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function ModelsVoiceSettingsPage() {
  return (
    <SettingsPageFrame
      title="Voice"
      description="Configure the assistant voice behavior."
    >
      <div className="space-y-4">
        <div className="space-y-2 overflow-hidden rounded-xl border p-3">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Voice engine
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            OpenAI TTS
          </div>
          <div className="px-1 text-xs text-muted-foreground">
            Voice uses OpenAI transcription, governed response generation, and
            OpenAI TTS.
          </div>
        </div>

        <VoicePanel />
      </div>
    </SettingsPageFrame>
  );
}
