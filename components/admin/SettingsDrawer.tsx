"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

import { PersonalizationPanel } from "@/components/admin/PersonalizationPanel";
import { VoicePanel } from "@/components/admin/VoicePanel";
import GrokVoiceRealtimePanel from "@/components/admin/GrokVoiceRealtimePanel";
import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { ChatModelPanel } from "@/components/admin/ChatModelPanel";
import { VantageProfilePage } from "@/components/admin/settings/VantageProfilePage";
import { VantagePersonalizationEditor } from "@/components/admin/settings/VantagePersonalizationEditor";
import { DeveloperToolsPage } from "@/components/admin/settings/DeveloperToolsPage";


import { SettingsRow } from "@/components/admin/settings/SettingsRow";
import { SettingsStoreProvider, useSettingsStore } from "@/components/admin/settings/store";

const BRAND_FILTER_SILVER = "grayscale brightness-125 contrast-125 opacity-85";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type PageId =
  | "root"
  | "account"
  | "appearance"
  | "models_voice"
  | "vantage_profile"
  | "vantage_personalization"
  | "memory_cards"
  | "security";

const PAGE_TITLES: Record<PageId, string> = {
  root: "Settings",
  account: "Account",
  appearance: "Appearance",
  models_voice: "Models & Voice",
  vantage_profile: "Vantage Profile",
  vantage_personalization: "Personalization",
  memory_cards: "Developer",
  security: "Security",
};

function normalizeThemeRaw(raw: string | null) {
  const v = (raw || "").trim();
  if (!v) return "system";
  try {
    const parsed = JSON.parse(v);
    if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  } catch { }
  return v;
}

function prettyThemeLabel(raw: string | null) {
  const v = normalizeThemeRaw(raw).toLowerCase();
  if (!v || v === "system") return "System";
  if (v === "dark") return "Dark";
  if (v === "dark-hc") return "Dark (HC)";
  if (v === "light") return "Light";
  return v;
}


function DrawerInner({
  stack,
  setStack,
  label,
  initials,
  isAdmin,
  onLogout,
  onSecurityDone,
}: {
  stack: PageId[];
  setStack: React.Dispatch<React.SetStateAction<PageId[]>>;
  label: string;
  initials: string;
  isAdmin: boolean;
  onLogout: () => Promise<void>;
  onSecurityDone: () => void;
}) {
  const { applied, dirty, save } = useSettingsStore();

  const [personalizationVantageId, setPersonalizationVantageId] = React.useState<string>("RESSE");

  const [voiceEngine, setVoiceEngine] = React.useState<"openai_tts" | "grok_realtime">("openai_tts");

  React.useEffect(() => {
    let cancelled = false;

    try {
      const v = (localStorage.getItem("vs_voice_engine") || "").trim();
      setVoiceEngine(v === "grok_realtime" ? "grok_realtime" : "openai_tts");
    } catch { }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const md: any = data?.user?.user_metadata || {};
      const cloudEngine = String(md?.vs_voice_engine || "").trim();

      if (cancelled) return;
      if (cloudEngine === "grok_realtime" || cloudEngine === "openai_tts") {
        setVoiceEngine(cloudEngine);
        try {
          localStorage.setItem("vs_voice_engine", cloudEngine);
        } catch { }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("vs_voice_engine", voiceEngine);
    } catch { }

    void supabase.auth.updateUser({
      data: { vs_voice_engine: voiceEngine },
    });
  }, [voiceEngine]);

  const current = stack[stack.length - 1] ?? "root";
  const title = PAGE_TITLES[current] || "Settings";

  // Live theme label: theme persists immediately via localStorage,
  // but SettingsStore.applied.theme is only loaded when the drawer opens.
  let liveThemeRaw: string | null = applied.theme;
  if (typeof window !== "undefined") {
    try {
      liveThemeRaw = window.localStorage.getItem("vs_theme") ?? applied.theme;
    } catch { }
  }

  const push = React.useCallback((p: PageId) => setStack((s) => [...s, p]), [setStack]);
  const pop = React.useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [setStack]);

  return (
    <div className="flex h-svh flex-col">
      <div className="sticky top-0 z-10 border-b bg-background">
        <div className="px-3 py-3">
          <Dialog.Title className="sr-only">Settings</Dialog.Title>
          <Dialog.Description className="sr-only">
            Assistant, interface, account/security, and developer controls.
          </Dialog.Description>

          <div className="flex items-center justify-between gap-3">
            {/* LEFT: wordmark (always flush-left) */}
            <div className="min-w-0">
              <div className="relative flex items-center" style={{ height: 16, width: 140 }}>
                <Image
                  src="/brand/admin-wordmark.norm.svg"
                  alt="Admin"
                  fill
                  sizes="140px"
                  className={`object-contain object-left ${BRAND_FILTER_SILVER} scale-[1.15] origin-left`}
                />
              </div>
            </div>

            {/* RIGHT: controls */}
            <div className="flex items-center gap-2">
              {stack.length > 1 ? (
                <button
                  type="button"
                  onClick={pop}
                  className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                  aria-label="Back"
                  title="Back"
                >
                  ‹
                </button>
              ) : null}

              {current !== "vantage_personalization" ? (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={save}
                  disabled={!dirty}
                  title={dirty ? "Apply these Vantage settings to chat" : "No Vantage changes to apply"}
                >
                  Apply
                </button>
              ) : null}

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {current === "root" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
                <span className="text-sm font-semibold">{initials}</span>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">Signed in</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Assistant
              </div>
              <div className="overflow-hidden rounded-xl border">
                <div className="divide-y">
                  <SettingsRow
                    label="Vantage Profile"
                    value={String(applied.vantageId || "default").slice(0, 32)}
                    onClick={() => push("vantage_profile")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Interface
              </div>
              <div className="overflow-hidden rounded-xl border">
                <div className="divide-y">
                  <SettingsRow
                    label="Appearance"
                    value={prettyThemeLabel(liveThemeRaw)}
                    onClick={() => push("appearance")}
                  />
                  <SettingsRow
                    label="Models & Voice"
                    value={applied.model || "Default"}
                    onClick={() => push("models_voice")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Account & Security
              </div>
              <div className="overflow-hidden rounded-xl border">
                <div className="divide-y">
                  <SettingsRow label="Account" value={label} onClick={() => push("account")} />
                  <SettingsRow label="Security" onClick={() => push("security")} />
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Developer
                </div>
                <div className="overflow-hidden rounded-xl border">
                  <div className="divide-y">
                    <SettingsRow label="Developer tools" onClick={() => push("memory_cards")} />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground">
              Vantage changes are draft-only until Save. Chat model and voice settings apply immediately.
            </div>
          </div>
        )}

        {current === "account" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Session
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="divide-y">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm">Signed in as</div>
                      <div className="max-w-[210px] truncate text-sm text-muted-foreground">{label}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {current === "appearance" && (
          <div className="space-y-3">
            <PersonalizationPanel />
          </div>
        )}

        {current === "models_voice" && (
          <div className="space-y-3">
            <ChatModelPanel />

            <div className="space-y-2 overflow-hidden rounded-xl border p-3">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Voice engine
              </div>

              <select
                value={voiceEngine}
                onChange={(e) => setVoiceEngine(e.target.value as "openai_tts" | "grok_realtime")}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="openai_tts">OpenAI TTS (file)</option>
                <option value="grok_realtime">Grok (realtime streaming)</option>
              </select>

              <div className="px-1 text-xs text-muted-foreground">
                OpenAI uses <code>/api/tts</code>. Grok uses <code>/ws/voice</code> (streaming).
              </div>
            </div>

            {voiceEngine === "openai_tts" ? (
              <VoicePanel />
            ) : (
              <div className="space-y-2 overflow-hidden rounded-xl border p-3">
                <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Realtime Voice (Grok — streaming)
                </div>
                <div className="pt-2">
                  <GrokVoiceRealtimePanel />
                </div>
              </div>
            )}
          </div>
        )}

        {current === "vantage_profile" && (
          <div className="space-y-3">
            <VantageProfilePage
              onEditPersonalization={(vid) => {
                setPersonalizationVantageId(String(vid || "RESSE").trim().slice(0, 64).toUpperCase() || "RESSE");
                push("vantage_personalization");
              }}
            />
          </div>
        )}

        {current === "vantage_personalization" && (
          <div className="space-y-3">
            <VantagePersonalizationEditor vantageId={personalizationVantageId} />
          </div>
        )}

        {current === "memory_cards" && isAdmin && (
          <div className="space-y-3">
            <DeveloperToolsPage />
          </div>
        )}

        {current === "security" && (
          <div className="space-y-3">
            <SecurityPanel onDone={onSecurityDone} />
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsDrawer({
  trigger,
  defaultName = "Admin",
}: {
  trigger: React.ReactNode;
  defaultName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [stack, setStack] = React.useState<PageId[]>(["root"]);

  const [label, setLabel] = React.useState(defaultName);
  const [initials, setInitials] = React.useState("VS");
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        const role = (user as any)?.app_metadata?.role;
        setIsAdmin(role === "admin");

        const name =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          (user?.email as string | undefined)?.trim() ||
          defaultName;

        setLabel(name);
        setInitials(initialsFromName(name));
      } catch {
        setLabel(defaultName);
        setInitials("VS");
      }
    })();
  }, [defaultName]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch { }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    setOpen(false);
    window.location.reload();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setStack(["root"]);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Dialog.Content className="fixed left-0 top-0 z-[9999] h-svh w-[360px] max-w-[92vw] border-r bg-background shadow-xl">
          <SettingsStoreProvider open={open}>
            <DrawerInner
              stack={stack}
              setStack={setStack}
              label={label}
              initials={initials}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              onSecurityDone={() => {
                setOpen(false);
                window.location.reload();
              }}
            />
          </SettingsStoreProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
