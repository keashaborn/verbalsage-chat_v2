"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

type TemplateListItem = {
  template_id: string;
  name: string;
  status: string;
  created_at: string;
  latest_version_id?: string | null;
  latest_version?: number | null;
  latest_version_created_at?: string | null;
};

type FormVersion = {
  version_id: string;
  template_id: string;
  version: number;
  json_schema: any;
  ui_schema: any;
  metadata: any;
  created_at: string;
};

function coerceNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractUuid(s: string): string | null {
  const m = String(s || "")
    .trim()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CollectPage() {
  const [status, setStatus] = React.useState<string>("");

  const [ownerUserId, setOwnerUserId] = React.useState<string>("");
  const [clients, setClients] = React.useState<string[]>([]);
  const [loadingClients, setLoadingClients] = React.useState(false);

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [loadingPrograms, setLoadingPrograms] = React.useState(false);

  const [subjectId, setSubjectId] = React.useState<string>("self");
  const [programVid, setProgramVid] = React.useState<string>("");

  const [programVersion, setProgramVersion] = React.useState<FormVersion | null>(null);

  // Program-specific UI state
  const [date, setDate] = React.useState<string>(todayISO());
  const [context, setContext] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  // Count
  const [countStep, setCountStep] = React.useState<number>(1);

  // Duration
  const [durationRunning, setDurationRunning] = React.useState(false);
  const durationStartPerf = React.useRef<number | null>(null);
  const durationInterval = React.useRef<any>(null);
  const [durationSec, setDurationSec] = React.useState<number>(0);

  // These are global overlay template versions; exclude from program dropdown.
  const PHASE_TEMPLATE_VERSION_ID = "17211955-c47a-4c2a-b55f-55cc06065bc3";
  const CORRECTION_TEMPLATE_VERSION_ID = "82210580-9e1b-4b60-8bf6-39032b0b4915";

  // Derive owner from session (do not show in UI)
  React.useEffect(() => {
    if (ownerUserId) return;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) throw new Error("not signed in");
        setOwnerUserId(data.user.id);
      } catch (e: any) {
        setStatus(`error: ${e?.message || String(e)}`);
      }
    })();
  }, [ownerUserId]);

  async function loadPrograms() {
    setLoadingPrograms(true);
    setStatus("");
    try {
      if (!ownerUserId.trim()) throw new Error("owner not ready");
      const r = await fetch(`/api/forms/templates/${encodeURIComponent(ownerUserId.trim())}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`programs failed: HTTP ${r.status} ${t}`);
      const j = JSON.parse(t);
      const list: TemplateListItem[] = Array.isArray(j) ? j : [];
      setTemplates(list);
      setStatus(list.length ? `loaded ${list.length} programs` : "no programs");
    } catch (e: any) {
      setTemplates([]);
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setLoadingPrograms(false);
    }
  }

  async function loadClientsList() {
    setLoadingClients(true);
    setStatus("");
    try {
      if (!ownerUserId.trim()) throw new Error("owner not ready");

      // Pull recent entries for this owner across programs; build a distinct subject list.
      // v0: limit=500 (fast, sufficient). Later: add a dedicated /clients endpoint.
      const qs = new URLSearchParams();
      qs.set("owner_user_id", ownerUserId.trim());
      qs.set("limit", "500");

      const r = await fetch(`/api/forms/entries/list?${qs.toString()}`, { cache: "no-store" });
      const txt = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`clients failed: HTTP ${r.status} ${txt}`);

      const rows = JSON.parse(txt);
      const set = new Set<string>();
      if (Array.isArray(rows)) {
        for (const it of rows) {
          const sid = String(it?.subject_id || "").trim();
          if (sid) set.add(sid);
        }
      }

      // Default self first if present; else keep current subjectId.
      const list = Array.from(set).sort((a, b) => a.localeCompare(b));
      if (!list.includes("self")) list.unshift("self");
      setClients(list);

      // Ensure selected subject is valid.
      if (subjectId.trim() && !list.includes(subjectId.trim())) {
        setSubjectId(list[0] || "self");
      }

      setStatus(`loaded ${list.length} clients`);
    } catch (e: any) {
      setClients(subjectId.trim() ? [subjectId.trim()] : ["self"]);
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadProgramVersion(versionId: string) {
    setProgramVersion(null);
    setStatus("");
    const tv = extractUuid(versionId);
    if (!tv) return;

    try {
      const r = await fetch(`/api/forms/versions/${encodeURIComponent(tv)}`, { cache: "no-store" });
      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`program version failed: HTTP ${r.status} ${t}`);
      const v = JSON.parse(t) as FormVersion;
      setProgramVersion(v);

      // Reset per-program UI defaults
      setDate(todayISO());
      setContext("");
      setNotes("");
      setCountStep(1);
      resetDuration();

      setStatus(`loaded program v${v.version}`);
    } catch (e: any) {
      setProgramVersion(null);
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  React.useEffect(() => {
    if (!ownerUserId.trim()) return;
    // Auto-load once on first ready owner
    loadPrograms();
    loadClientsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  React.useEffect(() => {
    if (!programVid.trim()) return;
    loadProgramVersion(programVid.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programVid]);

  function measurementType(): string {
    const md = (programVersion?.metadata || {}) as any;
    return String(md?.measurement?.type || md?.program_spec_v0?.measurement?.type || "");
  }

  function schemaProps(): Record<string, any> {
    return (programVersion?.json_schema?.properties || {}) as Record<string, any>;
  }

  function durationKey(props: Record<string, any>): string | null {
    if (props.duration_seconds) return "duration_seconds";
    if (props.durationSeconds) return "durationSeconds";
    if (props.duration) return "duration";
    return null;
  }

  function startDuration() {
    if (durationRunning) return;
    setDurationSec(0);
    durationStartPerf.current = performance.now();
    setDurationRunning(true);

    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }

    durationInterval.current = setInterval(() => {
      if (durationStartPerf.current === null) return;
      const sec = Math.max(0, Math.round((performance.now() - durationStartPerf.current) / 1000));
      setDurationSec(sec);
    }, 250);
  }

  function stopDuration(): number {
    const start = durationStartPerf.current;
    let sec = durationSec;
    if (start !== null) {
      sec = Math.max(0, Math.round((performance.now() - start) / 1000));
      setDurationSec(sec);
    }
    setDurationRunning(false);
    durationStartPerf.current = null;
    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
    } catch { }
    durationInterval.current = null;
    return sec;
  }

  function resetDuration() {
    stopDuration();
    setDurationSec(0);
  }

  React.useEffect(() => {
    return () => {
      try {
        if (durationInterval.current) clearInterval(durationInterval.current);
      } catch { }
    };
  }, []);

  async function submitEntry(data: Record<string, any>) {
    if (!ownerUserId.trim()) throw new Error("owner not ready");
    if (!subjectId.trim()) throw new Error("client required");
    const tv = extractUuid(programVid);
    if (!tv) throw new Error("program required");

    const payload = {
      owner_user_id: ownerUserId.trim(),
      subject_id: subjectId.trim(),
      template_version_id: tv,
      data,
    };

    const r = await fetch("/api/forms/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const t = await r.text().catch(() => "");
    if (!r.ok) throw new Error(`submit failed: HTTP ${r.status} ${t}`);

    const resp = JSON.parse(t);
    return resp;
  }

  async function recordCount() {
    setStatus("");
    try {
      if (!programVersion) throw new Error("program not loaded");
      const props = schemaProps();
      if (!props.count) throw new Error('schema missing "count"');
      if (!date.trim()) throw new Error("date required");

      const data: Record<string, any> = {};
      if (date.trim()) data.date = date.trim();
      data.count = Math.max(0, Math.trunc(countStep || 1));

      if (context.trim()) data.context = context.trim();
      if (notes.trim()) data.notes = notes.trim();

      const resp = await submitEntry(data);
      setStatus(`recorded entry_id=${resp?.entry_id || "ok"}`);
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  async function recordDurationStop() {
    setStatus("");
    try {
      if (!programVersion) throw new Error("program not loaded");
      const props = schemaProps();
      const dk = durationKey(props);
      if (!dk) throw new Error('schema missing duration field (expected "duration_seconds")');
      if (!date.trim()) throw new Error("date required");

      const sec = stopDuration();

      const data: Record<string, any> = {};
      if (date.trim()) data.date = date.trim();
      data[dk] = Math.max(0, Math.trunc(sec));

      if (context.trim()) data.context = context.trim();
      if (notes.trim()) data.notes = notes.trim();

      const resp = await submitEntry(data);
      setStatus(`recorded entry_id=${resp?.entry_id || "ok"}`);
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  const mType = measurementType();
  const props = schemaProps();

  // Collect v0: treat context/notes as generic optional fields for count/duration programs.
  // Do not require the schema to declare them (backend stores arbitrary JSON).
  const showContext = mType === "count" || mType === "duration";
  const showNotes = showContext;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Collect</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Ultra-minimal data capture. Owner is derived from your login.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
              onClick={loadClientsList}
              disabled={!ownerUserId.trim() || loadingClients}
              title="Reload clients"
            >
              {loadingClients ? "Loading…" : "Clients"}
            </button>
            <button
              className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
              onClick={loadPrograms}
              disabled={!ownerUserId.trim() || loadingPrograms}
              title="Reload programs"
            >
              {loadingPrograms ? "Loading…" : "Programs"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</div>
            <select
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Program</div>
            <select
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={programVid}
              onChange={(e) => setProgramVid(e.target.value)}
            >
              <option value="">(choose)</option>
              {templates
                .filter((t) => {
                  const vid = String(t.latest_version_id || "").trim();
                  if (!vid) return false;
                  if (vid === PHASE_TEMPLATE_VERSION_ID) return false;
                  if (vid === CORRECTION_TEMPLATE_VERSION_ID) return false;
                  return true;
                })
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
                .map((t) => (
                  <option key={t.template_id} value={String(t.latest_version_id)}>
                    {t.name} (v{t.latest_version ?? "?"})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          {!programVersion ? (
            <div className="text-sm text-muted-foreground">Select a program to begin.</div>
          ) : (
            <>
              <div className="text-sm font-semibold">
                {String(programVersion.json_schema?.title || "Program")} · measurement={mType || "unknown"}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {props.date ? (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</div>
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                ) : null}

                {showContext ? (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context</div>
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="home"
                    />
                  </div>
                ) : null}
              </div>

              {showNotes ? (
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                  <textarea
                    className="h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              ) : null}

              {mType === "count" ? (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Step</div>
                    <input
                      className="w-24 rounded-xl border bg-background px-3 py-2 text-sm"
                      type="number"
                      min={1}
                      value={countStep}
                      onChange={(e) => setCountStep(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                    />
                  </div>

                  <button
                    className="mt-3 w-full rounded-2xl bg-muted px-4 py-5 text-lg font-semibold hover:bg-muted/60"
                    onClick={recordCount}
                    disabled={!subjectId.trim() || !extractUuid(programVid) || (props.date && !date.trim())}
                    title="Record one count event"
                  >
                    Record
                  </button>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Writes: owner_user_id + subject_id + template_version_id + data (date/count/context/notes).
                  </div>
                </div>
              ) : mType === "duration" ? (
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground">Duration: {durationSec}s</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                      onClick={startDuration}
                      disabled={durationRunning}
                    >
                      Start
                    </button>
                    <button
                      className="flex-1 rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                      onClick={recordDurationStop}
                      disabled={!durationRunning}
                      title="Stop and write entry"
                    >
                      Stop + Save
                    </button>
                    <button
                      className="rounded-xl bg-muted px-3 py-3 text-sm font-semibold hover:bg-muted/60"
                      onClick={resetDuration}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Stop writes the entry; measurements are append-only.
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  Collect v0 supports measurement types <code>count</code> and <code>duration</code>.
                </div>
              )}
            </>
          )}
        </div>

        {status ? <div className="mt-3 text-sm text-muted-foreground">{status}</div> : null}
      </div>
    </div>
  );
}
