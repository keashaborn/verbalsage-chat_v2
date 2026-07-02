"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

type ConditioningSessionRow = {
  conditioning_session_log_id: string;
  owner_user_id: string;
  my_conditioning_prescription_id?: string | null;
  day: string;
  name: string;
  category: string;
  modality: string;
  duration_min: number;
  intensity: string;
  distance: string;
  heart_rate_avg?: number | null;
  recovery_impact: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prescription_name?: string | null;
};

async function fetchJson(url: string, init?: RequestInit) {
  const r = await authFetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text().catch(() => "");
  let j: any = null;

  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    // keep null
  }

  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 300) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }

  return j;
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export default function ConditioningLogSection({
  targetUserId = "",
  readOnly = false,
}: {
  targetUserId?: string;
  readOnly?: boolean;
}) {
  const showDebug =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const [rows, setRows] = React.useState<ConditioningSessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState("loading conditioning sessions...");
  const [openConditioningActionsId, setOpenConditioningActionsId] = React.useState("");

  async function loadRows() {
    setLoading(true);
    setStatus("loading conditioning sessions...");

    try {
      const targetParam = targetUserId ? `&target_user_id=${encodeURIComponent(targetUserId)}` : "";
      const j = (await fetchJson(`/api/lifeswitch/training/conditioning_sessions?limit=250${targetParam}`)) as ConditioningSessionRow[];
      const arr = Array.isArray(j) ? j : [];

      arr.sort((a, b) => {
        const c = String(b.day || "").localeCompare(String(a.day || ""));
        if (c !== 0) return c;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

      setRows(arr);
      setStatus(`loaded ${arr.length} conditioning sessions`);
    } catch (e: any) {
      setRows([]);
      setStatus(`conditioning load error: ${String(e?.message || e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  async function deleteRow(id: string, name: string) {
    if (readOnly) {
      setStatus("delegated read-only view: delete is not allowed");
      return;
    }

    const ok = window.confirm(`Delete conditioning session "${name}"?`);
    if (!ok) return;

    try {
      await fetchJson(`/api/lifeswitch/training/conditioning_sessions/${encodeURIComponent(id)}/deactivate`, {
        method: "POST",
      });
      setOpenConditioningActionsId("");
      await loadRows();
    } catch (e: any) {
      setStatus(`delete failed: ${String(e?.message || e)}`);
    }
  }

  return (
    <section className="mt-8 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Conditioning Sessions</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Completed conditioning sessions from Conditioning Capture.
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/30"
          onClick={() => void loadRows()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh conditioning"}
        </button>
      </div>

      {showDebug ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">Debug</summary>
          <div className="mt-2 text-xs font-mono text-muted-foreground">{status}</div>
        </details>
      ) : null}

      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 25).map((c) => (
            <div key={c.conditioning_session_log_id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.day} · {safeNum(c.duration_min, 0)} min
                    {c.distance ? ` · ${c.distance}` : ""}
                    {c.intensity ? ` · ${c.intensity}` : ""}
                  </div>
                  {c.recovery_impact ? (
                    <div className="mt-2 text-xs text-muted-foreground">Recovery: {c.recovery_impact}</div>
                  ) : null}
                  {c.notes ? <div className="mt-2 text-xs text-muted-foreground">{c.notes}</div> : null}
                </div>

                {!readOnly ? (
                  <div className="grid shrink-0 justify-items-end gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/30"
                      onClick={() =>
                        setOpenConditioningActionsId((prev) =>
                          prev === c.conditioning_session_log_id ? "" : c.conditioning_session_log_id
                        )
                      }
                      aria-expanded={openConditioningActionsId === c.conditioning_session_log_id}
                    >
                      Actions
                      {openConditioningActionsId === c.conditioning_session_log_id ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {openConditioningActionsId === c.conditioning_session_log_id ? (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                          Danger zone
                        </div>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10"
                          onClick={() => void deleteRow(c.conditioning_session_log_id, c.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete session
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border p-4 text-sm text-muted-foreground">
          No conditioning sessions yet. Save one from Conditioning Capture and it will appear here.
        </div>
      )}
    </section>
  );
}
