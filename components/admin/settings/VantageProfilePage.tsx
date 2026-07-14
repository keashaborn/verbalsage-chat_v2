"use client";

import * as React from "react";
import { useSettingsStore } from "@/components/admin/settings/store";
import { supabase } from "@/lib/supabaseClient";

type VantageLimits = { Y: number; R: number; C: number; S: number };

type RoutingControls = {
  answer_first: boolean;
  clarify_bias: number; // 0..1
  max_clarify_questions: number; // 0..3
};

type MixControls = {
  conversation: number; // 0..1
  memory_cards: number; // 0..1
  corpus: number; // 0..1
  lens_fm: number; // 0..1
  recency_bias: number; // 0..1
  similarity_threshold: number; // 0..1
};

type PragmaticsControls = {
  rfg: number; // 0..1 Ritual-First Gate
  df: number; // 0..1 Disclosure Friction
  pe: number; // 0..3 Persona Embodiment (integer)
};

type VantageProfile = {
  id: string;
  name: string; // display name (we treat this as the namespace name)
  state: {
    vantageId: string;
    limits: VantageLimits;
    routing: RoutingControls;
    mix: MixControls;
    roleplay: RoleplayControls;
    pragmatics: PragmaticsControls;
  };
  created_at: string;
  updated_at: string;
};

const DEFAULT_LIMITS: VantageLimits = { Y: 0.1, R: 0.2, C: 0.4, S: 0.4 };
const DEFAULT_ROUTING: RoutingControls = { answer_first: true, clarify_bias: 0.1, max_clarify_questions: 1 };
const DEFAULT_MIX: MixControls = {
  conversation: 0.6,
  memory_cards: 0.7,
  corpus: 0.8,
  lens_fm: 0.8,
  recency_bias: 0.6,
  similarity_threshold: 0.4,
};
const DEFAULT_PRAGMATICS: PragmaticsControls = { rfg: 0.0, df: 0.7, pe: 2 };

const BUILTIN_PERSONA_SCRIPTS: Record<string, string> = {
  RESSE: `You are RESSE: a precise, direct, technically capable assistant with a behavioral and systems-oriented mind.

Voice: calm, pragmatic, exact. You are shaped by Fractal Monism, radical behaviorism, radical pragmatism, and personal responsibility, but do not force philosophy into every answer. Use those lenses when they clarify perception, behavior, consequences, systems, or repeated patterns.

Never use litotes or anaphora. Use short, clear paragraphs. Prefer concrete language over abstraction. Do not flatter. Do not soften corrections so much that the correction becomes unclear.

For code, infrastructure, product design, or system architecture, proceed step-by-step. Identify the server, file, command, and expected output. Avoid guessing paths or state; verify with deterministic commands.

When terminal output contradicts the plan, revise plainly. Ask one focused clarifying question only when necessary. Otherwise give the safest next verification or patch.

Do not end every response with a generic next-step prompt. Give a next step when implementation, debugging, or planning requires it. Be direct without being hostile. Correct errors plainly. Keep the work moving.`,

  MORGAN: `You are Morgan: balanced, practical, socially natural, and easy to talk to. You are neither overly formal nor overly casual.

Use clear, normal language. Keep the tone calm, direct, and conversational. A little warmth is good; excessive praise, flattery, or therapy-speak is not.

Do not constantly remind the user that you are an AI. Be transparent when directly asked or when a limitation matters, but do not volunteer AI disclaimers as a default habit.

Match the user's mode. If the user is casual, respond casually. If the user asks a direct question, answer directly. If the user is making a decision, organize the variables. If the user is troubleshooting, become more systematic.

Ask clarifying questions only when missing information would materially change the answer. Prefer one focused question over several.

Do not turn every conversation into a task. Offer next steps when useful, but let casual exchanges end naturally. Correct errors plainly and practically.

Do not agree to unsafe, unverified, or poorly specified actions just to be agreeable.`,

  RILEY: `You are Riley: casual, socially natural, upbeat, and easy to talk to. Sound like a relaxed, witty friend who can be useful without turning every exchange into a project.

Use natural conversational language: contractions, short-to-medium sentences, and normal rhythm. Light humor, dry wit, and playful observations are welcome when they fit. Keep it friendly and grounded. Avoid sounding theatrical, overly intimate, or performative.

Do not constantly remind the user that you are an AI. Be transparent when directly asked or when a limitation matters, but do not volunteer AI disclaimers as a default habit.

Start socially when the user starts socially. If they greet you, check in, joke, vent lightly, or make casual conversation, respond naturally before moving into task mode.

Move into task mode only when the user asks for help, analysis, instructions, planning, troubleshooting, or a concrete answer. Do not end every reply by pushing the user into a next step.

Be warm without sounding like a therapist. Avoid heavy empathy, validation stacking, excessive praise, fake intimacy, and forced optimism. Correct errors plainly when needed, but keep the tone friendly.

Do not agree to unsafe, unverified, or poorly specified actions just to be agreeable.`,
};

function makeBuiltinProfile(args: {
  id: string;
  name: string;
  limits: VantageLimits;
  routing: RoutingControls;
  mix: MixControls;
  pragmatics: PragmaticsControls;
}): VantageProfile {
  return {
    id: args.id,
    name: args.name,
    state: {
      vantageId: args.name.toUpperCase(),
      limits: args.limits,
      routing: args.routing,
      mix: args.mix,
      pragmatics: args.pragmatics,
      roleplay: {
        on: true,
        strict: false,
        script: BUILTIN_PERSONA_SCRIPTS[args.name.toUpperCase()] || "",
        use_personalization: "none",
      },
    },
    created_at: "2026-06-26T00:00:00.000Z",
    updated_at: "2026-06-26T00:00:00.000Z",
  };
}

const BUILTIN_VANTAGE_PROFILES: VantageProfile[] = [
  makeBuiltinProfile({
    id: "builtin-resse",
    name: "RESSE",
    mix: {
      conversation: 0.7,
      memory_cards: 0.7,
      corpus: 0.8,
      lens_fm: 0.7,
      recency_bias: 0.7,
      similarity_threshold: 0.4,
    },
    routing: {
      answer_first: true,
      clarify_bias: 0.1,
      max_clarify_questions: 1,
    },
    pragmatics: {
      rfg: 0.35,
      df: 0.8,
      pe: 2,
    },
    limits: {
      Y: 0.2,
      R: 0.6,
      C: 0.4,
      S: 0.25,
    },
  }),
  makeBuiltinProfile({
    id: "builtin-morgan",
    name: "MORGAN",
    mix: {
      conversation: 0.75,
      memory_cards: 0.55,
      corpus: 0.45,
      lens_fm: 0.2,
      recency_bias: 0.7,
      similarity_threshold: 0.35,
    },
    routing: {
      answer_first: true,
      clarify_bias: 0.15,
      max_clarify_questions: 1,
    },
    pragmatics: {
      rfg: 0.7,
      df: 0.8,
      pe: 2,
    },
    limits: {
      Y: 0.12,
      R: 0.6,
      C: 0.4,
      S: 0.4,
    },
  }),
  makeBuiltinProfile({
    id: "builtin-riley",
    name: "RILEY",
    mix: {
      conversation: 0.8,
      memory_cards: 0.6,
      corpus: 0.35,
      lens_fm: 0.1,
      recency_bias: 0.75,
      similarity_threshold: 0.3,
    },
    routing: {
      answer_first: true,
      clarify_bias: 0.2,
      max_clarify_questions: 1,
    },
    pragmatics: {
      rfg: 0.85,
      df: 0.75,
      pe: 3,
    },
    limits: {
      Y: 0.12,
      R: 0.6,
      C: 0.4,
      S: 0.5,
    },
  }),
];

function isBuiltinProfileId(id: string): boolean {
  return String(id || "").startsWith("builtin-");
}

function mergeBuiltinProfiles(userProfiles: VantageProfile[]): VantageProfile[] {
  const user = normalizeProfileList(userProfiles).filter((p: any) => !isBuiltinProfileId(String(p.id || "")));
  const userNames = new Set(user.map((p: any) => normalizeVantageId(p?.state?.vantageId || p?.name)));
  const builtins = BUILTIN_VANTAGE_PROFILES.filter((p) => !userNames.has(normalizeVantageId(p.state.vantageId)));
  return [...builtins, ...user];
}

function userProfilesOnly(profiles: VantageProfile[]): VantageProfile[] {
  return normalizeProfileList(profiles).filter((p: any) => !isBuiltinProfileId(String(p.id || "")));
}

const LS_PROFILES = "vs_vantage_profiles";
const LS_DEFAULT_PROFILE_ID = "vs_vantage_default_id";
const LS_LEGACY_PRESETS = "vs_vantage_presets";

const CLOUD_PRESETS_KEY = "vs_vantage_profiles_v1";

async function cloudGetPresets(): Promise<{ profiles: any[]; defaultId: string } | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    const um: any = data.user.user_metadata || {};
    const blob = um[CLOUD_PRESETS_KEY];
    if (!blob || typeof blob !== "object") return { profiles: [], defaultId: "" };
    return {
      profiles: normalizeProfileList(Array.isArray(blob.profiles) ? blob.profiles : []),
      defaultId: typeof blob.defaultId === "string" ? blob.defaultId : "",
    };
  } catch {
    return null;
  }
}

async function cloudSetPresets(profiles: any[], defaultId: string) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return;
    const um: any = data.user.user_metadata || {};
    const cleanProfiles = normalizeProfileList(profiles);
    const next = { ...(um[CLOUD_PRESETS_KEY] || {}), profiles: cleanProfiles, defaultId, updated_at: new Date().toISOString() };
    await supabase.auth.updateUser({ data: { ...um, [CLOUD_PRESETS_KEY]: next } });
  } catch {
    // ignore
  }
}

function clamp01(x: any, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}
function clampInt(x: any, lo: number, hi: number, d: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  const v = Math.round(n);
  return v < lo ? lo : v > hi ? hi : v;
}

function sanitizeLimits(raw: any): VantageLimits {
  if (!raw || typeof raw !== "object") return DEFAULT_LIMITS;
  return {
    Y: clamp01(raw.Y, DEFAULT_LIMITS.Y),
    R: clamp01(raw.R, DEFAULT_LIMITS.R),
    C: clamp01(raw.C, DEFAULT_LIMITS.C),
    S: clamp01(raw.S, DEFAULT_LIMITS.S),
  };
}

function sanitizeRouting(raw: any): RoutingControls {
  if (!raw || typeof raw !== "object") return DEFAULT_ROUTING;
  const r: any = raw as any;
  return {
    answer_first: typeof r.answer_first === "boolean" ? r.answer_first : DEFAULT_ROUTING.answer_first,
    clarify_bias: clamp01(r.clarify_bias, DEFAULT_ROUTING.clarify_bias),
    max_clarify_questions: clampInt(r.max_clarify_questions, 0, 3, DEFAULT_ROUTING.max_clarify_questions),
  };
}

function sanitizeMix(raw: any): MixControls {
  if (!raw || typeof raw !== "object") return DEFAULT_MIX;
  return {
    conversation: clamp01(raw.conversation, DEFAULT_MIX.conversation),
    memory_cards: clamp01(raw.memory_cards, DEFAULT_MIX.memory_cards),
    corpus: clamp01(raw.corpus, DEFAULT_MIX.corpus),
    lens_fm: clamp01(raw.lens_fm, DEFAULT_MIX.lens_fm),
    recency_bias: clamp01(raw.recency_bias, DEFAULT_MIX.recency_bias),
    similarity_threshold: clamp01(raw.similarity_threshold, DEFAULT_MIX.similarity_threshold),
  };
}

function sanitizePragmatics(raw: any): PragmaticsControls {
  if (!raw || typeof raw !== "object") return DEFAULT_PRAGMATICS;
  return {
    rfg: clamp01((raw as any).rfg, DEFAULT_PRAGMATICS.rfg),
    df: clamp01((raw as any).df, DEFAULT_PRAGMATICS.df),
    pe: clampInt((raw as any).pe, 0, 3, DEFAULT_PRAGMATICS.pe),
  };
}

type RoleplayPersonalizationMode = "none" | "about_only" | "full";

type RoleplayControls = {
  on: boolean;
  strict: boolean;
  script: string;
  use_personalization: RoleplayPersonalizationMode;
};

const DEFAULT_ROLEPLAY: RoleplayControls = {
  on: false,
  strict: false,
  script: "",
  use_personalization: "none",
};

function sanitizeRoleplay(raw: any): RoleplayControls {
  if (!raw || typeof raw !== "object") return DEFAULT_ROLEPLAY;

  const up = String((raw as any).use_personalization || "").trim() as RoleplayPersonalizationMode;
  const use_personalization: RoleplayPersonalizationMode =
    up === "full" ? "full" : up === "about_only" ? "about_only" : "none";

  return {
    on: !!(raw as any).on,
    strict: !!(raw as any).strict,
    script: typeof (raw as any).script === "string" ? String((raw as any).script).slice(0, 2000) : "",
    use_personalization,
  };
}

function normalizeVantageId(v: any): string {
  const raw = String(v ?? "").trim().slice(0, 64);
  if (!raw) return "default";
  const s = raw.toLowerCase() === "default" ? "default" : raw.toUpperCase();
  return s;
}


function normalizeProfileIdentity(p: any): any {
  const state = p?.state && typeof p.state === "object" ? p.state : {};
  const stateVid = normalizeVantageId(state.vantageId);
  const nameVid = normalizeVantageId(p?.name);

  // Prefer real runtime namespace. If it is blank/default but the display name is real, use the name.
  const vid = stateVid && stateVid !== "default" ? stateVid : nameVid && nameVid !== "default" ? nameVid : "RESSE";

  return {
    ...p,
    name: vid,
    state: {
      ...state,
      vantageId: vid,
    },
  };
}

function normalizeProfileList(arr: any[]): any[] {
  return (Array.isArray(arr) ? arr : []).map(normalizeProfileIdentity);
}

function uid8(): string {
  return Math.random().toString(16).slice(2, 10);
}

function lsGetRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSetRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch { }
}
function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch { }
}

function loadProfiles(): VantageProfile[] {
  const raw = lsGetRaw(LS_PROFILES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return normalizeProfileList(arr
      .filter((p) => p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string")
      .map((p: any) => ({
        id: String(p.id),
        name: String(p.name).slice(0, 64),
        state: {
          vantageId: normalizeVantageId(p?.state?.vantageId),
          limits: sanitizeLimits(p?.state?.limits),
          routing: sanitizeRouting(p?.state?.routing),
          mix: sanitizeMix(p?.state?.mix),
          roleplay: sanitizeRoleplay(p?.state?.roleplay),
          pragmatics: sanitizePragmatics(p?.state?.pragmatics),
        },
        created_at: String(p.created_at || new Date().toISOString()),
        updated_at: String(p.updated_at || p.created_at || new Date().toISOString()),
      })));
  } catch {
    return [];
  }
}

function saveProfiles(arr: VantageProfile[]) {
  lsSetRaw(LS_PROFILES, JSON.stringify(normalizeProfileList(arr)));
}

function getDefaultProfileId(): string {
  return String(lsGetRaw(LS_DEFAULT_PROFILE_ID) || "");
}
function setDefaultProfileId(id: string) {
  lsSetRaw(LS_DEFAULT_PROFILE_ID, id);
}
function clearDefaultProfileId() {
  lsRemove(LS_DEFAULT_PROFILE_ID);
}

function migrateLegacyPresetsIfNeeded() {
  const existing = lsGetRaw(LS_PROFILES);
  if (existing) return;

  const legacyRaw = lsGetRaw(LS_LEGACY_PRESETS);
  if (!legacyRaw) return;

  try {
    const arr = JSON.parse(legacyRaw);
    if (!Array.isArray(arr) || arr.length === 0) return;

    const now = new Date().toISOString();
    const migrated: VantageProfile[] = arr
      .filter((p) => p && typeof p === "object")
      .map((p: any) => ({
        id: String(p.id || uid8()),
        name: String(p.name || "Migrated").slice(0, 64),
        state: {
          vantageId: "default",
          limits: sanitizeLimits(p.limits),
          routing: DEFAULT_ROUTING,
          mix: DEFAULT_MIX,
          roleplay: DEFAULT_ROLEPLAY,
          pragmatics: DEFAULT_PRAGMATICS,
        },
        created_at: String(p.created_at || now),
        updated_at: String(p.updated_at || p.created_at || now),
      }));

    saveProfiles(migrated);
  } catch { }
}

function InfoTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement | null>(null);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Help"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-5 items-center justify-center rounded-md border bg-background/40 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
      >
        ?
      </button>

      <div
        className={[
          "absolute right-0 top-7 z-50 w-[300px] rounded-xl border bg-background/95 p-2 text-xs leading-snug text-muted-foreground shadow-xl backdrop-blur-sm",
          open ? "block" : "hidden",
        ].join(" ")}
      >
        {children}
      </div>
    </span>
  );
}

function Group({
  title,
  children,
  help,
}: {
  title: string;
  children: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {help ? <InfoTip>{help}</InfoTip> : null}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="divide-y">{children}</div>
      </div>
    </div>
  );
}

function Row({
  left,
  right,
  children,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{left}</div>
        {right != null && <div className="shrink-0">{right}</div>}
      </div>
      {children != null && <div className="mt-2">{children}</div>}
    </div>
  );
}

function ActionRow({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function SliderRow({
  title,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v: number) => v.toFixed(2),
  onChange,
}: {
  title: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <Row left={title} right={<span className="text-xs tabular-nums text-muted-foreground">{format(value)}</span>}>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Row>
  );
}

function stableJson(x: any) {
  return JSON.stringify(x);
}

function sameState(a: VantageProfile["state"], b: VantageProfile["state"]) {
  return (
    normalizeVantageId(a.vantageId) === normalizeVantageId(b.vantageId) &&
    stableJson(sanitizeLimits(a.limits)) === stableJson(sanitizeLimits(b.limits)) &&
    stableJson(sanitizeRouting(a.routing)) === stableJson(sanitizeRouting(b.routing)) &&
    stableJson(sanitizeMix(a.mix)) === stableJson(sanitizeMix(b.mix)) &&
    stableJson(sanitizeRoleplay(a.roleplay)) === stableJson(sanitizeRoleplay(b.roleplay)) &&
    stableJson(sanitizePragmatics(a.pragmatics)) === stableJson(sanitizePragmatics(b.pragmatics))
  );
}

export function VantageProfilePage({
  onEditPersonalization,
  isAdmin = false,
}: {
  onEditPersonalization?: (vantageId: string) => void;
  isAdmin?: boolean;
}) {
  const { applied, draft, setDraft } = useSettingsStore();

  const limits = sanitizeLimits(draft.limits);
  const routing = sanitizeRouting(draft.routing);
  const mix = sanitizeMix(draft.mix);
  const pragmatics = sanitizePragmatics((draft as any).pragmatics);
  const roleplay = sanitizeRoleplay((draft as any).roleplay);
  const namespace = normalizeVantageId(draft.vantageId);

  const [profiles, setProfiles] = React.useState<VantageProfile[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [defaultId, setDefaultId] = React.useState<string>("");
  const [msg, setMsg] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      migrateLegacyPresetsIfNeeded();

      // Cloud is authoritative for cross-browser consistency.
      // If not signed in, show empty presets (do not silently fall back to local).
      const cloud = await cloudGetPresets();
      const ps = mergeBuiltinProfiles(normalizeProfileList((cloud && cloud.profiles) ? cloud.profiles : []));
      const defId = (cloud && typeof cloud.defaultId === "string") ? cloud.defaultId : "";

      setProfiles(ps);
      setDefaultId(defId);

      // try to select the profile matching the applied cookie-state
      const appliedState: VantageProfile["state"] = {
        vantageId: normalizeVantageId(applied.vantageId),
        limits: sanitizeLimits(applied.limits),
        routing: sanitizeRouting(applied.routing),
        mix: sanitizeMix(applied.mix),
        roleplay: sanitizeRoleplay((applied as any).roleplay),
        pragmatics: sanitizePragmatics((applied as any).pragmatics),
      };
      const match = ps.find((p: any) => sameState(p.state, appliedState));
      setSelectedId(match ? match.id : "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.vantageId, applied.limits, applied.routing, applied.mix, applied.pragmatics, (applied as any).roleplay]);
  function currentDraftState(): VantageProfile["state"] {
    return {
      vantageId: normalizeVantageId(draft.vantageId),
      limits: sanitizeLimits(draft.limits),
      routing: sanitizeRouting(draft.routing),
      mix: sanitizeMix(draft.mix),
      roleplay: sanitizeRoleplay((draft as any).roleplay),
      pragmatics: sanitizePragmatics((draft as any).pragmatics),
    };
  }

  function loadIntoDraft(p: VantageProfile) {
    const clean = normalizeProfileIdentity(p) as VantageProfile;
    setDraft((s) => ({
      ...s,
      vantageId: clean.state.vantageId,
      limits: clean.state.limits,
      routing: clean.state.routing,
      mix: clean.state.mix,
      roleplay: clean.state.roleplay,
      pragmatics: clean.state.pragmatics
    }));
  }

  const selected = selectedId ? profiles.find((p) => p.id === selectedId) : null;
  const defaultProfile = defaultId ? profiles.find((p) => p.id === defaultId) : null;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Choose an assistant profile. Apply makes this profile active in chat.
      </div>

      <Group title="Profile">
        <Row
          left="Active Assistant Profile"
          right={
            <input
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={draft.vantageId ?? ""}
              onChange={(e) => setDraft((s) => ({ ...s, vantageId: e.target.value }))}
              placeholder="default"
            />
          }
        />

        <div className="pt-1">
          <button
            type="button"
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60"
            onClick={() => {
              const vid = String(draft.vantageId || "RESSE").trim().slice(0, 64).toUpperCase() || "RESSE";
              if (onEditPersonalization) onEditPersonalization(vid);
              else window.location.assign(`/personalization?vantage_id=${encodeURIComponent(vid)}`);
            }}
          >
            Edit personalization for this profile
          </button>
        </div>

        <Row
          left="Choose Assistant Profile"
          right={
            <select
              className="w-[210px] rounded-lg border bg-background px-2 py-1.5 text-sm"
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setMsg("");
                setSelectedId(id);
                const p = profiles.find((x) => x.id === id);
                if (p) {
                  loadIntoDraft(p);
                  setMsg(`Loaded "${p.name}" into draft.`);
                }
              }}
            >
              <option value="">(none)</option>
              {profiles
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          }
        />

        <div className="px-1 text-xs text-muted-foreground">
          <span className="font-semibold">Apply</span> makes the selected assistant profile active in chat. Built-in profiles are available to everyone.
        </div>

        <details className="border-t">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold hover:bg-muted/60">
            Manage Profile
          </summary>
          <div className="divide-y">
<ActionRow
          label={`Save Profile "${namespace}"`}
          onClick={() => {
            setMsg("");
            const now = new Date().toISOString();

            const existing = profiles.find((p) => normalizeVantageId(p.state?.vantageId || p.name) === namespace);
            const state = { ...currentDraftState(), vantageId: namespace };

            if (existing) {
              const ok = window.confirm(`Overwrite existing Profile "${existing.name}"?`);
              if (!ok) return;

              const next = profiles.map((p) =>
                p.id === existing.id ? normalizeProfileIdentity({ ...p, name: namespace, state, updated_at: now }) : normalizeProfileIdentity(p)
              );
              setProfiles(next);
              saveProfiles(next);
              void cloudSetPresets(userProfilesOnly(next), defaultId);
              setSelectedId(existing.id);
              setMsg(`Overwrote Profile "${namespace}".`);
              return;
            }

            const p: VantageProfile = normalizeProfileIdentity({ id: uid8(), name: namespace, state, created_at: now, updated_at: now });
            const next = [p, ...profiles];
            setProfiles(next);
            saveProfiles(next);
            void cloudSetPresets(userProfilesOnly(next), defaultId);
            setSelectedId(p.id);
            setMsg(`Saved Profile "${namespace}".`);
          }}
        /><ActionRow
          label="Delete Profile"
          disabled={!selectedId}
          onClick={() => {
            if (!selected) return;
            const ok = window.confirm(`Delete Profile "${selected.name}"?`);
            if (!ok) return;

            const next = profiles.filter((p) => p.id !== selected.id);
            setProfiles(next);
            saveProfiles(next); // local cache

            const nextDefaultId = defaultId === selected.id ? "" : defaultId;
            if (defaultId === selected.id) clearDefaultProfileId(); // local cache
            void cloudSetPresets(userProfilesOnly(next as any), nextDefaultId);

            if (defaultId === selected.id) setDefaultId("");
            setSelectedId("");
            setMsg(`Deleted "${selected.name}".`);
          }}
        />
          </div>
        </details>
        </Group>

      {msg ? <div className="px-1 text-xs text-muted-foreground">{msg}</div> : null}
      <Group
        title="Conversation context"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Thread context</span>: higher = injects more recent thread turns as
              normal <code>messages[]</code> (requires a real <code>thread_id</code>).
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_mix</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Thread context"
          value={mix.conversation}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), conversation: v } }))}
        />
      </Group>

      <Group
        title="Retrieval weights"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Personal memory</span>: scales how many personal-memory hits are
              retrieved (also requires <code>VANTAGE_PERSONAL_MEMORY=1</code> on Brains).
            </div>
            <div>
              <span className="font-semibold">Fractal Monism corpus</span>: scales how much the current Fractal Monism knowledge base is used.
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_mix</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Personal memory"
          value={mix.memory_cards}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), memory_cards: v } }))}
        />
        <SliderRow
          title="Fractal Monism corpus"
          value={mix.corpus}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), corpus: v } }))}
        />
      </Group>


      <Group
        title="Lenses"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Fractal Monism lens</span>: injects a Fractal Monism framing constraint block into the prompt (instruction overlay, not retrieval).
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_mix</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Fractal Monism lens"
          value={mix.lens_fm}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), lens_fm: v } }))}
        />
      </Group>




      {isAdmin ? (
      <details className="space-y-3 rounded-xl border p-3">
        <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Admin tuning
        </summary>

        <div className="pt-3 space-y-4">
      <Group
        title="Context filters & ranking"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Context match strictness</span>: higher = only use closer retrieval matches.
            </div>
            <div>
              <span className="font-semibold">Prefer recent context</span>: higher = reranks toward newer items (not a hard
              filter).
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_mix</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Context match strictness"
          value={mix.similarity_threshold}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), similarity_threshold: v } }))}
        />
        <SliderRow
          title="Prefer recent context"
          value={mix.recency_bias}
          onChange={(v) => setDraft((s) => ({ ...s, mix: { ...sanitizeMix(s.mix), recency_bias: v } }))}
        />
      </Group>

      <Group
        title="Answering behavior"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Answer directly by default</span>: ON prefers a direct answer. OFF allows more clarification first.
            </div>
            <div>
              <span className="font-semibold">Ask-questions tendency</span>: 0 disables clarification. Higher increases the tendency to ask clarifying questions when allowed.
            </div>
            <div>
              <span className="font-semibold">Question limit before answering</span>: hard cap on clarifying questions. 0 disables clarifying; 1–3 limits question count.
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_routing</code>
            </div>
          </div>
        }
      >
        <Row
          left="Answer directly by default"
          right={
            <input
              type="checkbox"
              checked={routing.answer_first}
              onChange={(e) =>
                setDraft((s) => ({ ...s, routing: { ...sanitizeRouting(s.routing), answer_first: e.target.checked } }))
              }
            />
          }
        />
        <SliderRow
          title="Ask-questions tendency"
          value={routing.clarify_bias}
          onChange={(v) => setDraft((s) => ({ ...s, routing: { ...sanitizeRouting(s.routing), clarify_bias: v } }))}
        />
        <SliderRow
          title="Question limit before answering"
          value={routing.max_clarify_questions}
          min={0}
          max={3}
          step={1}
          format={(v) => String(Math.round(v))}
          onChange={(v) =>
            setDraft((s) => ({
              ...s,
              routing: { ...sanitizeRouting(s.routing), max_clarify_questions: clampInt(v, 0, 3, 1) },
            }))
          }
        />
      </Group>

      <Group
        title="Social behavior"
        help={
          <div className="space-y-1">
            <div>
              Controls greetings/check-ins, social presence, and AI self-disclosure. Separate from retrieval and extra wording.
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_pragmatics</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Conversational opening"
          value={pragmatics.rfg}
          onChange={(v) =>
            setDraft((s: any) => ({
              ...s,
              pragmatics: { ...sanitizePragmatics(s.pragmatics), rfg: v },
            }))
          }
        />
        <SliderRow
          title="AI disclaimer restraint"
          value={pragmatics.df}
          onChange={(v) =>
            setDraft((s: any) => ({
              ...s,
              pragmatics: { ...sanitizePragmatics(s.pragmatics), df: v },
            }))
          }
        />
        <SliderRow
          title="Persona intensity"
          value={pragmatics.pe}
          min={0}
          max={3}
          step={1}
          format={(v) => String(Math.round(v))}
          onChange={(v) =>
            setDraft((s: any) => ({
              ...s,
              pragmatics: { ...sanitizePragmatics(s.pragmatics), pe: clampInt(v, 0, 3, 2) },
            }))
          }
        />
      </Group>

      <Group
        title="Response limiters"
        help={
          <div className="space-y-1">
            <div>
              <span className="font-semibold">Agreeability under pressure</span>: higher = concedes/defers more when challenged; lower = holds firm.
            </div>
            <div>
              <span className="font-semibold">Evidence-based revision</span>: higher = revises more readily when new facts appear; lower = more stable.
            </div>
            <div>
              <span className="font-semibold">Adaptation strength</span>: longer-run shaping/coupling; verify actual effect via inspector/meta.
            </div>
            <div>
              <span className="font-semibold">Extra wording</span>: higher = more verbosity, hedges, affirmations, compliments, and decorative phrasing.
            </div>
            <div className="pt-1">
              Cookie: <code>vs_vantage_limits</code>
            </div>
          </div>
        }
      >
        <SliderRow
          title="Agreeability under pressure"
          value={limits.Y}
          onChange={(v) => setDraft((s) => ({ ...s, limits: { ...sanitizeLimits(s.limits), Y: v } }))}
        />
        <SliderRow
          title="Evidence-based revision"
          value={limits.R}
          onChange={(v) => setDraft((s) => ({ ...s, limits: { ...sanitizeLimits(s.limits), R: v } }))}
        />
        <SliderRow
          title="Adaptation strength"
          value={limits.C}
          onChange={(v) => setDraft((s) => ({ ...s, limits: { ...sanitizeLimits(s.limits), C: v } }))}
        />
        <SliderRow
          title="Extra wording"
          value={limits.S}
          onChange={(v) => setDraft((s) => ({ ...s, limits: { ...sanitizeLimits(s.limits), S: v } }))}
        />
      </Group>
        </div>
      </details>
      ) : null}

    </div>
  );
}
