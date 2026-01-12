"use client";

import * as React from "react";

export function CardsPanel() {
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null);

  const [kindKey, setKindKey] = React.useState<string>("all");
  const [showAllVersions, setShowAllVersions] = React.useState<boolean>(false);
  const [showRaw, setShowRaw] = React.useState<boolean>(false);

  React.useEffect(() => {
    let nextKindKey = "all";
    try {
      const k = localStorage.getItem("vs_cards_kind");
      if (k) nextKindKey = JSON.parse(k);
      setKindKey(nextKindKey);

      const sa = localStorage.getItem("vs_cards_show_all");
      if (sa != null) setShowAllVersions(JSON.parse(sa));

      const sr = localStorage.getItem("vs_cards_show_raw");
      if (sr != null) setShowRaw(JSON.parse(sr));
    } catch { }

    // This panel is rendered as its own Settings "page", so load immediately
    // (avoids the extra click on the <summary> header).
    load(nextKindKey);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PROTECTED_KINDS = new Set([
    "gravity_profile",
    "vb_desire_profile",
    "user_identity",
    "assistant_identity",
    "style_mode",
    "style",
  ]);

  const KIND_OPTIONS: { key: string; label: string; kinds?: string }[] = [
    { key: "all", label: "All cards" },
    { key: "gravity", label: "Gravity", kinds: "gravity_profile" },
    { key: "desire", label: "Desire", kinds: "vb_desire_profile" },
    { key: "identity", label: "Identity", kinds: "user_identity" },
    { key: "style", label: "Style", kinds: "assistant_identity,style,style_mode,preference" },
  ];

  function dedupeLatestByKind(arr: any[]) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const it of arr) {
      const k = String(it.kind || "");
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
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
    return String(it.text || "").trim() || "No text.";
  }

  async function load(nextKindKey: string = kindKey) {
    setLoading(true);
    setErr(null);
    try {
      const opt = KIND_OPTIONS.find((o) => o.key === nextKindKey);
      const qs = new URLSearchParams();
      qs.set("limit", "100");
      if (opt?.kinds) qs.set("kinds", opt.kinds);

      const r = await fetch(`/api/admin/cards?${qs.toString()}`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      let arr = Array.isArray(data?.items) ? data.items : [];

      arr.sort((a: any, b: any) =>
        String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
      );

      setItems(arr);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    const ok = window.confirm("Delete this card?");
    if (!ok) return;
    const r = await fetch(`/api/admin/cards/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) load();
    else alert(await r.text().catch(() => "delete failed"));
  }

  const displayItems = showAllVersions ? items : dedupeLatestByKind(items);

  return (
    <details
      className="mb-4 rounded-xl border p-3"
      open={open}
      onToggle={(e) => {
        const isOpen = (e.target as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && items.length === 0 && !loading) load();
      }}
    >
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Memory Cards
      </summary>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={kindKey}
            onChange={(e) => {
              const v = e.target.value;
              setKindKey(v);
              try { localStorage.setItem("vs_cards_kind", JSON.stringify(v)); } catch { }
              load(v);
            }}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

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

        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {err && <div className="text-xs text-red-400">{err}</div>}

        {displayItems.map((it) => {
          const isOpen = expandedCardId === it.id;
          return (
            <div key={it.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex-1 text-left text-xs text-muted-foreground"
                  onClick={() => setExpandedCardId(isOpen ? null : it.id)}
                >
                  <span className="font-semibold">{it.kind || "memory"}</span>
                  {it.updated_at ? ` • ${it.updated_at}` : it.created_at ? ` • ${it.created_at}` : ""}
                </button>

                {PROTECTED_KINDS.has(String(it.kind || "")) ? (
                  <span className="text-xs text-muted-foreground" title="Protected system card (delete disabled)">
                    🔒
                  </span>
                ) : (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    title="Delete card"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      del(it.id);
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-2 space-y-3">
                  <div className="whitespace-pre-wrap text-sm">{prettySummary(it)}</div>

                  {showRaw && it.payload ? (
                    <pre className="max-h-64 overflow-auto rounded-lg border bg-background/40 p-2 text-xs">
                      {JSON.stringify(it.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {!loading && displayItems.length === 0 && (
          <div className="text-xs text-muted-foreground">No cards found for this category.</div>
        )}
      </div>
    </details>
  );
}
