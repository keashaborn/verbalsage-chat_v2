"use client";

import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabaseClient";
import * as React from "react";

type CardSource = "vantage" | "legacy";

type CardKindOption = {
  key: string;
  label: string;
  kinds?: string;
  topicIncludes?: string;
};

const CLOUD_PRESETS_KEY = "vs_vantage_profiles_v1";
const LS_PROFILES = "vs_vantage_profiles";
const LS_CARDS_VANTAGE_ID = "vs_cards_vantage_id";

const BUILTIN_CARD_VANTAGES = ["RESSE", "MORGAN", "RILEY", "EVA", "default"];

function normalizeCardVantageId(raw: any): string {
  const v = String(raw || "").trim().slice(0, 64);
  return v || "";
}

function addProfileIdsFromArray(out: Set<string>, arr: any[]) {
  if (!Array.isArray(arr)) return;

  for (const p of arr) {
    if (!p || typeof p !== "object") continue;

    const direct =
      normalizeCardVantageId((p as any)?.state?.vantageId) ||
      normalizeCardVantageId((p as any)?.vantageId) ||
      normalizeCardVantageId((p as any)?.name);

    if (direct) out.add(direct);
  }
}

async function readProfileRegistryVantageIds(): Promise<string[]> {
  const out = new Set<string>(BUILTIN_CARD_VANTAGES);

  try {
    const stored = localStorage.getItem(LS_CARDS_VANTAGE_ID);
    if (stored) {
      const parsed = JSON.parse(stored);
      const v = normalizeCardVantageId(parsed);
      if (v) out.add(v);
    }
  } catch { }

  try {
    const raw = localStorage.getItem(LS_PROFILES);
    if (raw) addProfileIdsFromArray(out, JSON.parse(raw));
  } catch { }

  try {
    const { data } = await supabase.auth.getUser();
    const um: any = data?.user?.user_metadata || {};
    const blob = um[CLOUD_PRESETS_KEY];

    if (blob && typeof blob === "object") {
      addProfileIdsFromArray(out, Array.isArray(blob.profiles) ? blob.profiles : []);
    }
  } catch { }

  return Array.from(out).filter(Boolean).sort((a, b) => {
    const rank = (v: string) => {
      const idx = BUILTIN_CARD_VANTAGES.indexOf(v);
      return idx >= 0 ? idx : 100;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

export function CardsPanel() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null);

  const [sourceKey, setSourceKey] = React.useState<CardSource>("vantage");
  const [vantageId, setVantageId] = React.useState<string>("RESSE");
  const [kindKey, setKindKey] = React.useState<string>("all");
  const [showAllVersions, setShowAllVersions] = React.useState<boolean>(false);
  const [showRaw, setShowRaw] = React.useState<boolean>(false);

  const PROTECTED_KINDS = new Set([
    "gravity_profile",
    "vb_desire_profile",
    "user_identity",
    "assistant_identity",
    "style_mode",
    "style",
    "pref",
    "system",
  ]);

  const LEGACY_KIND_OPTIONS: CardKindOption[] = [
    { key: "all", label: "All legacy cards" },
    { key: "gravity", label: "Gravity", kinds: "gravity_profile" },
    { key: "desire", label: "Desire", kinds: "vb_desire_profile" },
    { key: "identity", label: "Identity", kinds: "user_identity" },
    { key: "style", label: "Style", kinds: "assistant_identity,style,style_mode,preference" },
  ];

  const VANTAGE_KIND_OPTIONS: CardKindOption[] = [
    { key: "all", label: "All live cards" },
    { key: "pref", label: "Preferences", kinds: "pref" },
    { key: "style", label: "Style", kinds: "pref", topicIncludes: "/pref/style" },
    { key: "identity", label: "Identity", kinds: "identity" },
    { key: "background", label: "Background", kinds: "background" },
    { key: "project", label: "Project", kinds: "project" },
    { key: "system", label: "System", kinds: "system" },
    { key: "gravity", label: "Gravity", kinds: "gravity" },
    { key: "desire", label: "Desire", kinds: "desire" },
  ];

  const [vantageOptions, setVantageOptions] = React.useState<string[]>(BUILTIN_CARD_VANTAGES);

  function kindOptions(src: CardSource) {
    return src === "vantage" ? VANTAGE_KIND_OPTIONS : LEGACY_KIND_OPTIONS;
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      let nextSource: CardSource = "vantage";
      let nextVantage = "RESSE";
      let nextKindKey = "all";

      try {
        const src = localStorage.getItem("vs_cards_source");
        if (src === "legacy" || src === "vantage") nextSource = src;

        const vid = localStorage.getItem(LS_CARDS_VANTAGE_ID);
        if (vid) nextVantage = JSON.parse(vid);

        const k = localStorage.getItem("vs_cards_kind");
        if (k) nextKindKey = JSON.parse(k);

        const sa = localStorage.getItem("vs_cards_show_all");
        if (sa != null) setShowAllVersions(JSON.parse(sa));

        const sr = localStorage.getItem("vs_cards_show_raw");
        if (sr != null) setShowRaw(JSON.parse(sr));
      } catch { }

      const options = await readProfileRegistryVantageIds();
      if (cancelled) return;

      setVantageOptions(options);

      if (nextSource === "vantage" && !options.includes(nextVantage)) {
        nextVantage = options.includes("RESSE") ? "RESSE" : options[0] || "RESSE";
        try { localStorage.setItem(LS_CARDS_VANTAGE_ID, JSON.stringify(nextVantage)); } catch { }
      }

      setSourceKey(nextSource);
      setVantageId(nextVantage);
      setKindKey(nextKindKey);

      load(nextKindKey, nextSource, nextVantage);
    })();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dedupeLatest(arr: any[], src: CardSource) {
    const seen = new Set<string>();
    const out: any[] = [];

    for (const it of arr) {
      const key =
        src === "vantage"
          ? String(it.topic_key || it.kind || it.id || "")
          : String(it.kind || it.id || "");

      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }

    return out;
  }

  function summarizeGravity(it: any) {
    const weights = it?.payload?.weights;
    if (!weights || typeof weights !== "object") return "No weights found.";

    const pairs = Object.entries(weights as Record<string, number>)
      .filter(([_, v]) => typeof v === "number" && Math.abs(v) >= 0.01)
      .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
      .slice(0, 12);

    if (!pairs.length) return "No significant weights (>= 0.01).";

    return pairs
      .map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${(v as number).toFixed(3)}`)
      .join("\n");
  }

  function summarizeDesire(it: any) {
    const rp = it?.payload?.request_patterns;
    const pref = it?.payload?.inferred_preferences;

    const lines: string[] = [];

    const top = (arr: any[], n = 6) =>
      Array.isArray(arr)
        ? arr
          .slice(0, n)
          .map((x) => `${x.key} (count=${x.count}, score=${x.score})`)
          .join("\n")
        : "None";

    if (rp) {
      lines.push("Top intents:\n" + top(rp.by_intent));
      lines.push("Top formats:\n" + top(rp.by_format));
      lines.push("Top topics:\n" + top(rp.by_topic));
    } else {
      lines.push("No request_patterns found.");
    }

    if (pref) {
      lines.push(
        "Inferred preferences:\n" +
        [
          `preferred_answer_length: ${pref.preferred_answer_length ?? "?"}`,
          `preferred_density: ${pref.preferred_density ?? "?"}`,
          `preferred_format_default: ${pref.preferred_format_default ?? "?"}`,
        ].join("\n")
      );
    }

    return lines.join("\n\n");
  }

  function prettySummary(it: any) {
    const kind = String(it.kind || "");
    if (kind === "gravity_profile") return summarizeGravity(it);
    if (kind === "vb_desire_profile") return summarizeDesire(it);
    return String(it.text || it.summary || "").trim() || "No text.";
  }

  function cardTitle(it: any) {
    if (sourceKey === "vantage") {
      const topic = String(it.topic_key || "");
      const last = topic.split("/").slice(-2).join("/");
      return last || String(it.kind || "vantage_card");
    }
    return String(it.kind || "memory");
  }


  function groupLabel(kind: string) {
    const k = String(kind || "").toLowerCase();
    if (k === "identity" || k === "user_identity" || k === "assistant_identity") return "Identity";
    if (k === "background") return "Background";
    if (k === "project") return "Project";
    if (k === "pref" || k === "preference") return "Preferences";
    if (k === "style" || k === "style_mode") return "Style";
    if (k === "policy" || k === "shaping") return "Policy / Shaping";
    if (k === "gravity" || k === "gravity_profile") return "Gravity";
    if (k === "desire" || k === "vb_desire_profile") return "Desire";
    if (k === "system") return "System";
    return "Other";
  }

  function groupOrder(label: string) {
    const order: Record<string, number> = {
      "Identity": 10,
      "Background": 20,
      "Project": 30,
      "Preferences": 40,
      "Style": 50,
      "Policy / Shaping": 60,
      "Gravity": 70,
      "Desire": 80,
      "System": 90,
      "Other": 100,
    };
    return order[label] ?? 999;
  }

  function groupedItems(arr: any[]) {
    const groups = new Map<string, any[]>();
    for (const it of arr) {
      const label = groupLabel(String(it.kind || ""));
      const list = groups.get(label) || [];
      list.push(it);
      groups.set(label, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => groupOrder(a) - groupOrder(b) || a.localeCompare(b))
      .map(([label, groupItems]) => ({ label, items: groupItems }));
  }

  async function load(
    nextKindKey: string = kindKey,
    nextSource: CardSource = sourceKey,
    nextVantageId: string = vantageId
  ) {
    setLoading(true);
    setErr(null);

    try {
      const options = kindOptions(nextSource);
      const opt = options.find((o) => o.key === nextKindKey) || options[0];

      const qs = new URLSearchParams();
      qs.set("limit", "100");

      if (nextSource === "vantage") {
        qs.set("vantage_id", nextVantageId || "RESSE");
        if (opt?.kinds) qs.set("kinds", opt.kinds);
      } else {
        if (opt?.kinds) qs.set("kinds", opt.kinds);
      }

      const endpoint =
        nextSource === "vantage"
          ? `/api/admin/vantage-cards?${qs.toString()}`
          : `/api/admin/cards?${qs.toString()}`;

      const r = await authFetch(endpoint);
      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      let arr = Array.isArray(data?.items) ? data.items : [];

      const topicIncludes = opt?.topicIncludes;
      if (nextSource === "vantage" && topicIncludes) {
        arr = arr.filter((it: any) => String(it.topic_key || "").includes(topicIncludes));
      }

      arr.sort((a: any, b: any) =>
        String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
      );

      setItems(arr);
      setExpandedCardId(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (sourceKey === "vantage") {
      alert("Delete is disabled for live Vantage cards for now.");
      return;
    }

    const ok = window.confirm("Delete this card?");
    if (!ok) return;

    const r = await authFetch(`/api/admin/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) load();
    else alert(await r.text().catch(() => "delete failed"));
  }

  const displayItems = showAllVersions ? items : dedupeLatest(items, sourceKey);

  return (
    <details
      className="mb-4 rounded-xl border p-3"
      open={open}
      onToggle={(e) => {
        // Ignore nested card-group <details> toggles.
        if (e.currentTarget !== e.target) return;

        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && items.length === 0 && !loading) load();
      }}
    >
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Memory Cards
      </summary>

      <div className="mt-3 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={sourceKey}
            onChange={(e) => {
              const v = e.target.value as CardSource;
              setSourceKey(v);
              const nextKind = "all";
              setKindKey(nextKind);
              try {
                localStorage.setItem("vs_cards_source", v);
                localStorage.setItem("vs_cards_kind", JSON.stringify(nextKind));
              } catch { }
              load(nextKind, v, vantageId);
            }}
          >
            <option value="vantage">Live Vantage Cards</option>
            <option value="legacy">Legacy Qdrant Cards</option>
          </select>

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={vantageId}
            disabled={sourceKey !== "vantage"}
            onChange={(e) => {
              const v = e.target.value;
              setVantageId(v);
              try { localStorage.setItem("vs_cards_vantage_id", JSON.stringify(v)); } catch { }
              load(kindKey, sourceKey, v);
            }}
          >
            {vantageOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={kindKey}
            onChange={(e) => {
              const v = e.target.value;
              setKindKey(v);
              try { localStorage.setItem("vs_cards_kind", JSON.stringify(v)); } catch { }
              load(v, sourceKey, vantageId);
            }}
          >
            {kindOptions(sourceKey).map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {sourceKey === "vantage"
              ? `Showing new Postgres Vantage cards for ${vantageId}.`
              : "Showing legacy Qdrant memory_raw cards."}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showAllVersions}
                onChange={(e) => {
                  const v = e.target.checked;
                  setShowAllVersions(v);
                  try { localStorage.setItem("vs_cards_show_all", JSON.stringify(v)); } catch { }
                }}
              />
              Show all
            </label>

            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showRaw}
                onChange={(e) => {
                  const v = e.target.checked;
                  setShowRaw(v);
                  try { localStorage.setItem("vs_cards_show_raw", JSON.stringify(v)); } catch { }
                }}
              />
              Raw
            </label>
          </div>
        </div>

        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {err && <div className="text-xs text-red-400">{err}</div>}

        {sourceKey === "vantage" ? (
          <div className="space-y-3">
            {groupedItems(displayItems).map((group) => (
              <details key={group.label} className="overflow-hidden rounded-xl border">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
                  {group.label} ({group.items.length})
                </summary>

                <div className="space-y-2 border-t p-3">
                  {group.items.map((it) => {
                    const isOpen = expandedCardId === it.id;
                    const isProtected = true;

                    return (
                      <div key={it.id} className="rounded-lg border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            className="flex-1 text-left text-xs text-muted-foreground"
                            onClick={() => setExpandedCardId(isOpen ? null : it.id)}
                          >
                            <span className="font-semibold">{cardTitle(it)}</span>
                            <span className="ml-2 opacity-80">{it.kind || "memory"}</span>
                            {it.updated_at ? ` • ${it.updated_at}` : it.created_at ? ` • ${it.created_at}` : ""}
                          </button>

                          <span className="text-xs text-muted-foreground" title="Protected live Vantage card">
                            🔒
                          </span>
                        </div>

                        {isOpen ? (
                          <div className="mt-2 space-y-2">
                            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                              {prettySummary(it)}
                            </pre>
                            {showRaw ? (
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px]">
                                {JSON.stringify(it, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : (
          displayItems.map((it) => {
            const isOpen = expandedCardId === it.id;
            const isProtected = PROTECTED_KINDS.has(String(it.kind || ""));

            return (
              <div key={it.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex-1 text-left text-xs text-muted-foreground"
                    onClick={() => setExpandedCardId(isOpen ? null : it.id)}
                  >
                    <span className="font-semibold">{cardTitle(it)}</span>
                    <span className="ml-2 opacity-80">{it.kind || "memory"}</span>
                    {it.updated_at ? ` • ${it.updated_at}` : it.created_at ? ` • ${it.created_at}` : ""}
                  </button>

                  {isProtected ? (
                    <span className="text-xs text-muted-foreground" title="Protected/system card">
                      🔒
                    </span>
                  ) : (
                    <button
                      className="text-xs text-red-400 hover:underline"
                      onClick={() => del(String(it.id))}
                    >
                      delete
                    </button>
                  )}
                </div>

                {isOpen ? (
                  <div className="mt-2 space-y-2">
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                      {prettySummary(it)}
                    </pre>
                    {showRaw ? (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px]">
                        {JSON.stringify(it, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}


        {!loading && displayItems.length === 0 && (
          <div className="text-xs text-muted-foreground">No cards found for this category.</div>
        )}
      </div>
    </details>
  );
}
