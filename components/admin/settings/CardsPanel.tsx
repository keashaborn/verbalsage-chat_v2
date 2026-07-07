"use client";

import { authFetch } from "@/lib/authFetch";
import * as React from "react";

type ScopeFilter = "all" | "CONTENT_OK" | "STYLE_ONLY" | "NEVER_SURFACE";
type StatusFilter = "all" | "active" | "retired";

const LS_MEMORY_INSPECTOR_VANTAGE = "vs_memory_inspector_vantage_id";
const LS_MEMORY_INSPECTOR_RAW = "vs_memory_inspector_show_raw";

const KIND_OPTIONS = [
  { key: "all", label: "All kinds", kinds: "" },
  { key: "identity", label: "Identity", kinds: "identity" },
  { key: "background", label: "Background", kinds: "background" },
  { key: "project", label: "Project", kinds: "project" },
  { key: "pref", label: "Preferences / Style", kinds: "pref,style" },
  { key: "system", label: "System", kinds: "system,audit" },
];

function asText(v: any, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function asArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function shortTopic(topicKey: any): string {
  const topic = String(topicKey || "").trim();
  if (!topic) return "untitled";
  const parts = topic.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || topic;
}

function policyClass(useScope: string) {
  if (useScope === "CONTENT_OK") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (useScope === "STYLE_ONLY") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (useScope === "NEVER_SURFACE") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-muted bg-muted/40 text-muted-foreground";
}

function statusClass(status: string) {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "retired") return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  return "border-muted bg-muted/40 text-muted-foreground";
}

function countWhere(items: any[], fn: (it: any) => boolean): number {
  return items.reduce((n, it) => n + (fn(it) ? 1 : 0), 0);
}

function groupLabel(it: any): string {
  const status = asText(it.status, "unknown");
  const scope = asText(it.use_scope, "unscoped");
  if (status !== "active") return "Retired / Suppressed";
  if (scope === "CONTENT_OK") return "Content Cards";
  if (scope === "STYLE_ONLY") return "Style / Preference Cards";
  if (scope === "NEVER_SURFACE") return "Never-Surface Cards";
  return "Other Cards";
}

function groupOrder(label: string): number {
  const order: Record<string, number> = {
    "Content Cards": 10,
    "Style / Preference Cards": 20,
    "Never-Surface Cards": 30,
    "Retired / Suppressed": 40,
    "Other Cards": 90,
  };
  return order[label] ?? 999;
}

function grouped(items: any[]) {
  const m = new Map<string, any[]>();
  for (const it of items) {
    const label = groupLabel(it);
    const arr = m.get(label) || [];
    arr.push(it);
    m.set(label, arr);
  }
  return Array.from(m.entries())
    .sort(([a], [b]) => groupOrder(a) - groupOrder(b))
    .map(([label, groupItems]) => ({ label, items: groupItems }));
}

function compactSummary(text: any, limit = 260): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= limit) return s;
  return s.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
}

function buildCardDigest(it: any): string {
  const domains = asArray(it.domains);
  const payload = it.payload && typeof it.payload === "object" ? it.payload : {};
  const reviewStatus = asText(it.review_status ?? payload.review_status, "—");
  const approvedBy = asText(it.approved_by ?? payload.approved_by, "—");
  const writeIntent = asText(it.write_intent ?? payload.write_intent, "—");

  return [
    "Memory Card Digest",
    `card_id: ${it.card_id ?? it.id ?? "—"}`,
    `vantage_id: ${asText(it.vantage_id, "—")}`,
    `kind: ${asText(it.kind, "—")}`,
    `status: ${asText(it.status, "—")}`,
    `topic_key: ${asText(it.topic_key, "—")}`,
    `use_scope: ${asText(it.use_scope, "—")}`,
    `surface_policy: ${asText(it.surface_policy, "—")}`,
    `review_status: ${reviewStatus}`,
    `approved_by: ${approvedBy}`,
    `write_intent: ${writeIntent}`,
    `strength: ${it.strength ?? "—"}`,
    `confidence: ${it.confidence ?? "—"}`,
    domains.length ? `domains: ${domains.join(", ")}` : "domains: —",
    `summary: ${compactSummary(it.text || it.summary, 420) || "—"}`,
  ].join("\n");
}

function buildVisibleCardsDigest(
  items: any[],
  meta: { vantageId: string; kindKey: string; statusFilter: string; scopeFilter: string }
): string {
  const lines: string[] = [];
  lines.push("Memory Inspector Visible Cards Digest");
  lines.push(`vantage_id: ${meta.vantageId || "user_global"}`);
  lines.push(`kind_filter: ${meta.kindKey}`);
  lines.push(`status_filter: ${meta.statusFilter}`);
  lines.push(`scope_filter: ${meta.scopeFilter}`);
  lines.push(`visible_count: ${items.length}`);
  lines.push("");

  items.forEach((it, idx) => {
    lines.push(`${idx + 1}. card_id=${it.card_id ?? it.id ?? "—"} | ${asText(it.kind, "—")} | ${asText(it.status, "—")} | ${asText(it.use_scope, "—")} | confidence=${it.confidence ?? "—"}`);
    lines.push(`   ${shortTopic(it.topic_key)}`);
    lines.push(`   policy: ${asText(it.surface_policy, "—")}`);
    lines.push(`   ${compactSummary(it.text || it.summary, 260) || "No summary."}`);
  });

  return lines.join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CardsPanel() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState("");

  const [vantageId, setVantageId] = React.useState("user_global");
  const [kindKey, setKindKey] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>("all");
  const [showRaw, setShowRaw] = React.useState(false);

  React.useEffect(() => {
    let nextVantageId = "user_global";

    try {
      const v = localStorage.getItem(LS_MEMORY_INSPECTOR_VANTAGE);
      if (v) nextVantageId = JSON.parse(v) || "user_global";

      const raw = localStorage.getItem(LS_MEMORY_INSPECTOR_RAW);
      if (raw != null) setShowRaw(Boolean(JSON.parse(raw)));
    } catch {}

    setVantageId(nextVantageId);
    load("all", nextVantageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(nextKindKey = kindKey, nextVantageId = vantageId) {
    setLoading(true);
    setErr(null);

    try {
      const opt = KIND_OPTIONS.find((o) => o.key === nextKindKey) || KIND_OPTIONS[0];

      const qs = new URLSearchParams();
      qs.set("limit", "500");
      qs.set("vantage_id", nextVantageId || "user_global");
      if (opt.kinds) qs.set("kinds", opt.kinds);

      const r = await authFetch(`/api/admin/vantage-cards?${qs.toString()}`);
      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      const arr = Array.isArray(data?.items) ? data.items : [];

      arr.sort((a: any, b: any) =>
        String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
      );

      setItems(arr);
      setExpandedId(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter((it) => {
    const status = asText(it.status, "active") as StatusFilter;
    const scope = asText(it.use_scope, "") as ScopeFilter;

    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (scopeFilter !== "all" && scope !== scopeFilter) return false;

    return true;
  });

  const stats = {
    total: items.length,
    active: countWhere(items, (it) => asText(it.status, "active") === "active"),
    retired: countWhere(items, (it) => asText(it.status) === "retired"),
    content: countWhere(items, (it) => asText(it.use_scope) === "CONTENT_OK"),
    style: countWhere(items, (it) => asText(it.use_scope) === "STYLE_ONLY"),
    never: countWhere(items, (it) => asText(it.use_scope) === "NEVER_SURFACE"),
  };

  async function copyVisibleDigest() {
    const ok = await copyTextToClipboard(buildVisibleCardsDigest(filteredItems, {
      vantageId,
      kindKey,
      statusFilter,
      scopeFilter,
    }));
    setCopyStatus(ok ? "visible digest copied" : "copy failed");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function copyCardDigest(it: any) {
    const ok = await copyTextToClipboard(buildCardDigest(it));
    setCopyStatus(ok ? "card digest copied" : "copy failed");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <details
      className="mb-4 rounded-xl border p-3"
      open={open}
      onToggle={(e) => {
        if (e.currentTarget !== e.target) return;
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && items.length === 0 && !loading) load();
      }}
    >
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Memory Inspector
      </summary>

      <div className="mt-3 space-y-3">
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="text-sm font-semibold">Memory Inspector</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Reads Postgres Vantage cards. Default scope is <code>user_global</code>. Policy fields show whether a card may be used as content, style only, or never surfaced.
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-6">
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-1 text-lg font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Active</div>
            <div className="mt-1 text-lg font-semibold">{stats.active}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Retired</div>
            <div className="mt-1 text-lg font-semibold">{stats.retired}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Content</div>
            <div className="mt-1 text-lg font-semibold">{stats.content}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Style</div>
            <div className="mt-1 text-lg font-semibold">{stats.style}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Never</div>
            <div className="mt-1 text-lg font-semibold">{stats.never}</div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={vantageId}
            onChange={(e) => {
              const v = e.target.value.trim() || "user_global";
              setVantageId(v);
              try { localStorage.setItem(LS_MEMORY_INSPECTOR_VANTAGE, JSON.stringify(v)); } catch {}
            }}
            onBlur={() => load(kindKey, vantageId)}
            placeholder="user_global"
          />

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={kindKey}
            onChange={(e) => {
              const v = e.target.value;
              setKindKey(v);
              load(v, vantageId);
            }}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="retired">Retired only</option>
          </select>

          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          >
            <option value="all">All policies</option>
            <option value="CONTENT_OK">CONTENT_OK</option>
            <option value="STYLE_ONLY">STYLE_ONLY</option>
            <option value="NEVER_SURFACE">NEVER_SURFACE</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Showing {filteredItems.length} of {items.length} cards for <code>{vantageId}</code>{copyStatus ? <span> · {copyStatus}</span> : null}.
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={copyVisibleDigest}
              disabled={filteredItems.length === 0}
            >
              Copy Visible
            </button>

            <button
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50"
              onClick={() => load(kindKey, vantageId)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>

            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showRaw}
                onChange={(e) => {
                  const v = e.target.checked;
                  setShowRaw(v);
                  try { localStorage.setItem(LS_MEMORY_INSPECTOR_RAW, JSON.stringify(v)); } catch {}
                }}
              />
              Raw JSON
            </label>
          </div>
        </div>

        {err ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{err}</div> : null}

        <div className="space-y-3">
          {grouped(filteredItems).map((group) => (
            <details key={group.label} className="overflow-hidden rounded-xl border" open>
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40">
                {group.label} ({group.items.length})
              </summary>

              <div className="space-y-2 border-t p-3">
                {group.items.map((it) => {
                  const id = String(it.id || it.card_id || it.topic_key || Math.random());
                  const isOpen = expandedId === id;
                  const domains = asArray(it.domains);
                  const title = shortTopic(it.topic_key);
                  const summary = asText(it.text || it.summary, "No summary.");
                  const useScope = asText(it.use_scope, "unknown");
                  const status = asText(it.status, "unknown");
                  const surfacePolicy = asText(it.surface_policy, "unknown");

                  return (
                    <div key={id} className="rounded-lg border px-3 py-2">
                      <button
                        className="w-full text-left"
                        onClick={() => setExpandedId(isOpen ? null : id)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{title}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {it.kind || "unknown"} · {it.updated_at || it.created_at || "no timestamp"}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px] uppercase tracking-wide">
                            <span className={`rounded-full border px-2 py-0.5 ${statusClass(status)}`}>{status}</span>
                            <span className={`rounded-full border px-2 py-0.5 ${policyClass(useScope)}`}>{useScope}</span>
                            <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-muted-foreground">{surfacePolicy}</span>
                          </div>
                        </div>

                        <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{summary}</div>

                        {domains.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {domains.map((d) => (
                              <span key={d} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>

                      {isOpen ? (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-muted-foreground">
                              Durable card details
                            </div>
                            <button
                              type="button"
                              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50"
                              onClick={() => copyCardDigest(it)}
                            >
                              Copy Card Digest
                            </button>
                          </div>

                          <div className="grid gap-2 text-[11px] text-muted-foreground md:grid-cols-2">
                            <div><span className="font-semibold">card_id:</span> {it.card_id || it.id || "?"}</div>
                            <div><span className="font-semibold">vantage_id:</span> {it.vantage_id || "?"}</div>
                            <div><span className="font-semibold">strength:</span> {it.strength ?? "?"}</div>
                            <div><span className="font-semibold">confidence:</span> {it.confidence ?? "?"}</div>
                          </div>

                          {showRaw ? (
                            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px]">
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

        {!loading && filteredItems.length === 0 ? (
          <div className="text-xs text-muted-foreground">No cards found for the selected filters.</div>
        ) : null}
      </div>
    </details>
  );
}
