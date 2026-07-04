"use client";

import { ChatModelPanel } from "@/components/admin/ChatModelPanel";
import { VoicePanel } from "@/components/admin/VoicePanel";
import { SettingsStoreProvider } from "@/components/admin/settings/store";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";

export default function ModelsVoiceSettingsPage() {
  return (
    <SettingsStoreProvider open={true}>
      <SettingsPageFrame
        title="Models & Voice"
        description="Configure the assistant model and voice behavior."
      >
        <div className="space-y-4">
          <ChatModelPanel />

          <div className="space-y-2 overflow-hidden rounded-xl border p-3">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Voice engine
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              OpenAI TTS
            </div>
            <div className="px-1 text-xs text-muted-foreground">
              OpenAI voice is the active provider. Realtime voice will use the OpenAI Realtime endpoint.
            </div>
          </div>

          <VoicePanel />
        </div>
      </SettingsPageFrame>
    </SettingsStoreProvider>
  );
}
