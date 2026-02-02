"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";

type TemplateListItem = {
  template_id: string;
  name: string;
  latest_version_id?: string | null;
  latest_version?: number | null;
};

type VersionDoc = {
  version_id: string;
  template_id: string;
  version: number;
  json_schema: any;
  ui_schema: any;
  metadata: any;
};

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  const t = await r.text().catch(() => "");
  let j: any = null;
  try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) {
    const detail = j?.detail || j?.error || t?.slice(0, 200) || `HTTP ${r.status}`;
    throw new Error(String(detail));
  }
  return j;
}

function lifedomain(md: any): string {
  const d = md?.lifeswitch?.domain;
  return typeof d === "string" ? d.trim().toLowerCase() : "";
}

export default function BehaviorCapturePage() {
  const [status, setStatus] = React.useState<string>("auth: loading…");
  const [ownerUserId, setOwnerUserId] = React.useState<string>("");

  const [templates, setTemplates] = React.useState<TemplateListItem[]>([]);
  const [versionsById, setVersionsById] = React.useState<Record<string, VersionDoc>>({});
  const [loading, setLoading] = React.useState(false);

  const [showAll, setShowAll] = React.useState(false);

  const [selectedVid, setSelectedVid] = React.useState<string>("");
  const [version, setVersion] = React.useState<VersionDoc | null>(null);

  const [formData, setFormData] = React.useState<any>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<string>("");

  // auth
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user?.id) throw new Error("not signed in");
        if (cancelled) return;
        setOwnerUserId(data.user.id);
        setStatus("ready");
      } catch (e: any) {
        if (cancelled) return;
        setOwnerUserId("");
        setStatus(`auth: ${e?.message || String(e)}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function load() {
    if (!ownerUserId) return;
    setLoading(true);
    setStatus("loading templates…");
    setSubmitStatus("");
    try {
      const list = (await fetchJson(`/api/forms/templates/${encodeURIComponent(ownerUserId)}`)) as TemplateListItem[];
      const items = Array.isArray(list) ? list : [];
      setTemplates(items);

      // fetch latest version docs (for domain tagging + schema)
      const nextMap: Record<string, VersionDoc> = {};
      for (const t of items) {
        const vid = String(t.latest_version_id || "").trim();
        if (!vid) continue;
        try {
          const v = (await fetchJson(`/api/forms/versions/${encodeURIComponent(vid)}`)) as VersionDoc;
          if (v?.version_id) nextMap[vid] = v;
        } catch {
          // ignore per-template failures
        }
      }
      setVersionsById(nextMap);

      // default selection: first behavior-tagged version; else first any
      const candidates = items
        .map((t) => String(t.latest_version_id || "").trim())
        .filter(Boolean);

      const behaviorFirst =
        candidates.find((vid) => lifedomain(nextMap[vid]?.metadata) === "behavior") || "";

      const nextSelected = behaviorFirst || candidates[0] || "";
      setSelectedVid(nextSelected);
      setVersion(nextSelected ? nextMap[nextSelected] || null : null);
      setFormData({});
      setStatus(`loaded ${items.length} templates`);
    } catch (e: any) {
      setTemplates([]);
      setVersionsById({});
      setSelectedVid("");
      setVersion(null);
      setFormData({});
      setStatus(`error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!ownerUserId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId]);

  const options = React.useMemo(() => {
    const out: Array<{ vid: string; label: string; domain: string }> = [];
    for (const t of templates) {
      const vid = String(t.latest_version_id || "").trim();
      if (!vid) continue;
      const v = versionsById[vid];
      const domain = lifedomain(v?.metadata);
      if (!showAll && domain && domain !== "behavior") continue;
      if (!showAll && !domain) continue; // untagged hidden by default
      out.push({
        vid,
        domain: domain || "(untagged)",
        label: `${t.name || "(untitled)"} (v${t.latest_version ?? "?"})`,
      });
    }
    // If showAll, include everything
    if (showAll) {
      const seen = new Set(out.map((x) => x.vid));
      for (const t of templates) {
        const vid = String(t.latest_version_id || "").trim();
        if (!vid || seen.has(vid)) continue;
        out.push({
          vid,
          domain: lifedomain(versionsById[vid]?.metadata) || "(untagged)",
          label: `${t.name || "(untitled)"} (v${t.latest_version ?? "?"})`,
        });
      }
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [templates, versionsById, showAll]);

  React.useEffect(() => {
    if (!selectedVid) {
      setVersion(null);
      return;
    }
    setVersion(versionsById[selectedVid] || null);
    setFormData({});
  }, [selectedVid, versionsById]);

  async function submit() {
    setSubmitting(true);
    setSubmitStatus("");
    try {
      if (!ownerUserId) throw new Error("not signed in");
      if (!selectedVid) throw new Error("select a measure");
      if (!version?.json_schema) throw new Error("missing schema");

      const payload = {
        owner_user_id: ownerUserId,
        subject_id: "self",
        template_version_id: selectedVid,
        data: formData ?? {},
      };

      const r = await fetch("/api/forms/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const t = await r.text().catch(() => "");
      if (!r.ok) throw new Error(`submit failed: HTTP ${r.status} ${t}`);

      const resp = JSON.parse(t);
      setSubmitStatus(`Submitted entry_id=${resp.entry_id || "?"}`);
      setFormData({});
    } catch (e: any) {
      setSubmitStatus(`Error: ${e?.message || String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="text-lg font-semibold">Behavior · Capture</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Select a measure template, enter data, submit. Templates tagged <span className="font-mono">lifeswitch.domain=behavior</span> show by default.
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug</summary>
        <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
          <div>auth: {ownerUserId ? ownerUserId : "not signed in"}</div>
          <div>status: {status}</div>
          <div>templates: {templates.length}</div>
          <div>options: {options.length}</div>
          <div>selected: {selectedVid || "(none)"}</div>
        </div>
      </details>

      <div className="mt-6 space-y-3 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Measure</div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              show all
            </label>
            <button
              type="button"
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
              onClick={load}
              disabled={!ownerUserId || loading}
            >
              {loading ? "Loading…" : "Reload"}
            </button>
          </div>
        </div>

        <select
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={selectedVid}
          onChange={(e) => setSelectedVid(e.target.value)}
          disabled={!ownerUserId}
        >
          <option value="">(choose)</option>
          {options.map((o) => (
            <option key={o.vid} value={o.vid}>
              {o.label} · {o.domain}
            </option>
          ))}
        </select>

        {version ? (
          <div className="mt-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              template_version_id=<span className="font-mono">{version.version_id}</span>
            </div>

            <Form
              schema={version.json_schema}
              uiSchema={version.ui_schema || {}}
              validator={validator}
              formData={formData}
              onChange={(e) => setFormData((e as any).formData)}
              onSubmit={() => submit()}
            >
              <button
                type="submit"
                className="w-full rounded-2xl bg-muted px-4 py-4 text-base font-semibold hover:bg-muted/60 disabled:opacity-40"
                disabled={submitting || !ownerUserId}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </Form>

            {submitStatus ? <div className="text-sm text-muted-foreground">{submitStatus}</div> : null}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a measure to begin.</div>
        )}
      </div>
    </div>
  );
}
