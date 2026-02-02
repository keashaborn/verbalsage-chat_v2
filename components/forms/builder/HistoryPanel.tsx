"use client";

import * as React from "react";
import { MiniLineChart } from "@/components/sslg/MiniLineChart";

// NOTE: v0 extraction: props are intentionally `any` to avoid a long typing pass.
// We’ll type/refine once the code is decomposed.
export default function HistoryPanel(p: any) {
  const {
    ready,
    historyXMode,
    setHistoryXMode,
    historyLimit,
    setHistoryLimit,
    loadHistory,
    historyLoading,

    templates,
    PHASE_TEMPLATE_VERSION_ID,
    loadTemplates,
    loadingTemplates,

    historyTemplateVersionId,
    setHistoryTemplateVersionId,
    selectedVersionId,

    phaseLoading,
    loadPhases,
    phaseDate,
    setPhaseDate,
    phaseLabel,
    setPhaseLabel,
    phaseNotes,
    setPhaseNotes,
    submitPhaseMarker,
    phaseSubmitting,
    phaseStatus,

    cleanupN,
    setCleanupN,
    cleanupCandidates,
    cleanupConfirm,
    setCleanupConfirm,
    cleanupNotes,
    setCleanupNotes,
    bulkVoidCandidates,
    cleanupSubmitting,
    cleanupStatus,
    extractUuid,
    subjectId,

    historyVersion,
    durationSeries,
    countSeries,
    phaseStarts,

    quickSubmitting,
    version,
    loadVersion,
    quickDate,
    setQuickDate,
    quickCount,
    setQuickCount,
    quickContext,
    setQuickContext,
    quickNotes,
    setQuickNotes,
    quickDurationSec,
    setQuickDurationSec,
    durationRunning,
    startDuration,
    stopDuration,
    resetDuration,
    submitQuick,

    historyRows,
  } = p;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">History</div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border bg-background px-3 py-2 text-sm"
            value={historyXMode}
            onChange={(e) => setHistoryXMode(e.target.value as any)}
            title="X-axis"
          >
            <option value="trial">Trial</option>
            <option value="date">Date</option>
          </select>

          <input
            className="w-24 rounded-xl border bg-background px-3 py-2 text-sm"
            type="number"
            min={1}
            max={500}
            value={historyLimit}
            onChange={(e) => setHistoryLimit(Number(e.target.value) || 50)}
            title="Limit"
          />
          <button
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={loadHistory}
            disabled={!ready || historyLoading}
          >
            {historyLoading ? "Loading…" : "Load history"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="w-full max-w-md rounded-xl border bg-background px-3 py-2 text-sm"
          value={historyTemplateVersionId}
          onChange={(e) => setHistoryTemplateVersionId(e.target.value)}
          title="History filter template_version_id"
        >
          <option value="">(any template version)</option>
          {templates
            .filter((t: any) => t.latest_version_id && t.latest_version_id !== PHASE_TEMPLATE_VERSION_ID)
            .map((t: any) => (
              <option key={t.template_id} value={t.latest_version_id as string}>
                {t.name} (v{t.latest_version ?? "?"})
              </option>
            ))}
        </select>

        <button
          type="button"
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={loadTemplates}
          disabled={!ready || loadingTemplates}
          title="Load templates for the dropdown"
        >
          {loadingTemplates ? "Loading…" : "Load templates"}
        </button>

        <button
          type="button"
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={() => setHistoryTemplateVersionId(selectedVersionId)}
          disabled={!selectedVersionId}
          title="Copy from Template version selector"
        >
          Use selected
        </button>

        <button
          type="button"
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={() => setHistoryTemplateVersionId("")}
          disabled={!historyTemplateVersionId}
        >
          Clear
        </button>
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Phase markers</div>
          <button
            type="button"
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={() => loadPhases()}
            disabled={!ready || phaseLoading}
            title="Reload phase marker rows"
          >
            {phaseLoading ? "Loading…" : "Load phases"}
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Target template_version_id: <span className="font-mono">{historyTemplateVersionId || "(none selected)"}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Phase start date</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              type="date"
              value={phaseDate}
              onChange={(e) => setPhaseDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Phase label</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
              placeholder="A / B / C ..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Notes (optional)</div>
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={phaseNotes}
            onChange={(e) => setPhaseNotes(e.target.value)}
            placeholder="baseline / intervention / setting change ..."
          />
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={submitPhaseMarker}
            disabled={!ready || phaseSubmitting || !subjectId.trim() || !historyTemplateVersionId.trim() || !phaseDate.trim() || !phaseLabel.trim()}
          >
            {phaseSubmitting ? "Submitting…" : "Submit phase marker"}
          </button>

          {phaseStatus ? <div className="text-xs text-muted-foreground">{phaseStatus}</div> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Test cleanup (void entries)</div>
          <div className="text-xs text-muted-foreground">ABA Entry Correction</div>
        </div>

        <div className="text-xs text-muted-foreground">
          Writes correction rows that void entries for the selected History template version. This does not physically delete data.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Void last N loaded entries</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              type="number"
              min={1}
              value={cleanupN}
              onChange={(e) => setCleanupN(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              Candidates={cleanupCandidates.length}. Increase “History limit” then “Load history” to reach older entries.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Confirm</div>
            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono"
              value={cleanupConfirm}
              onChange={(e) => setCleanupConfirm(e.target.value)}
              placeholder='type "VOID"'
            />
            <div className="text-xs text-muted-foreground">Required: Subject ID + History template_version_id</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Notes (optional)</div>
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={cleanupNotes}
            onChange={(e) => setCleanupNotes(e.target.value)}
            placeholder="why are you voiding these?"
          />
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={bulkVoidCandidates}
            disabled={
              !ready ||
              cleanupSubmitting ||
              cleanupConfirm.trim() !== "VOID" ||
              !subjectId.trim() ||
              !extractUuid(historyTemplateVersionId) ||
              cleanupCandidates.length === 0
            }
            title="Void candidates by writing correction entries"
          >
            {cleanupSubmitting ? "Voiding…" : "Void candidates"}
          </button>

          {cleanupStatus ? <div className="text-xs text-muted-foreground">{cleanupStatus}</div> : null}
        </div>
      </div>

      {(() => {
        const tv = String(historyTemplateVersionId || "").trim();
        if (!tv) {
          return (
            <div className="text-sm text-muted-foreground">
              Select a template version (History filter), then click “Load history” to plot.
            </div>
          );
        }

        const md = (historyVersion?.metadata || {}) as any;
        const gs = (md.graph_spec_v0 || null) as any;
        const meas = (md.measurement || md.program_spec_v0?.measurement || {}) as any;
        const mType = String(meas?.type || "");

        const series =
          mType === "duration" ? durationSeries :
            mType === "count" ? countSeries :
              (durationSeries.length && !countSeries.length ? durationSeries : countSeries);

        const xLabel = String(gs?.x?.label || (historyXMode === "date" ? "Date" : "Trial"));
        const yUnit = String(gs?.y?.unit || "");
        const yLabel = String(gs?.y?.label || historyVersion?.json_schema?.title || "Y");
        const yLabelWithUnit = yUnit ? `${yLabel} (${yUnit})` : yLabel;
        const title = String(gs?.y?.label || historyVersion?.json_schema?.title || "ABA graph");
        const includeZero = gs?.y?.include_zero;

        return (
          <div className="space-y-2">
            <MiniLineChart
              title={title}
              series={series}
              xMode={historyXMode}
              includeZero={includeZero ?? true}
              phases={phaseStarts}
              breakAtPhaseChange={true}
              xLabel={xLabel}
              yLabel={yLabelWithUnit}
            />
            <div className="text-xs text-muted-foreground">
              template_version_id={tv} · measurement={mType || "unknown"}
              {gs ? " · graph_spec_v0=on" : " · graph_spec_v0=none (fallback)"}
            </div>
          </div>
        );
      })()}

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Quick entry</div>
          <button
            className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
            onClick={loadTemplates}
            disabled={!ready || loadingTemplates}
          >
            {loadingTemplates ? "Loading…" : "Load templates"}
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Template version</div>
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={selectedVersionId}
            onChange={(e) => loadVersion(e.target.value)}
          >
            <option value="">(choose)</option>
            {templates.filter((t: any) => t.latest_version_id).map((t: any) => (
              <option key={t.template_id} value={t.latest_version_id as string}>
                {t.name} (v{t.latest_version ?? "?"})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Subject ID</div>
          <input
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={subjectId}
            onChange={(e) => p.setSubjectId(e.target.value)}
          />
        </div>

        {version ? (() => {
          const mType = String(
            version.metadata?.measurement?.type ||
            version.metadata?.program_spec_v0?.measurement?.type ||
            ""
          );
          const props = (version.json_schema?.properties || {}) as Record<string, any>;
          const canCount = mType === "count" && !!props.count;
          const canDuration = mType === "duration" && (!!props.duration_seconds || !!props.durationSeconds || !!props.duration);

          return (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Measurement: {mType || "unknown"} · template_version_id={version.version_id}
              </div>

              {canCount ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Date</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="date"
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Count</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60"
                          onClick={() => setQuickCount((c: number) => Math.max(0, (Number.isFinite(c) ? c : 0) - 1))}
                        >
                          −
                        </button>
                        <input
                          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                          type="number"
                          min={0}
                          value={quickCount}
                          onChange={(e) => setQuickCount(Number(e.target.value) || 0)}
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60"
                          onClick={() => setQuickCount((c: number) => (Number.isFinite(c) ? c : 0) + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {props.context ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Context</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={quickContext}
                        onChange={(e) => setQuickContext(e.target.value)}
                      />
                    </div>
                  ) : null}

                  {props.notes ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Notes</div>
                      <textarea
                        className="h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="pt-1">
                    <button
                      className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                      onClick={() => submitQuick("count")}
                      disabled={!ready || quickSubmitting || !subjectId.trim() || !quickDate}
                    >
                      {quickSubmitting ? "Submitting…" : "Submit count"}
                    </button>
                  </div>
                </div>
              ) : canDuration ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Date</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="date"
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Duration (sec)</div>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        type="number"
                        min={0}
                        value={quickDurationSec}
                        onChange={(e) => setQuickDurationSec(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40" onClick={startDuration} disabled={durationRunning}>Start</button>
                    <button type="button" className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40" onClick={stopDuration} disabled={!durationRunning}>Stop</button>
                    <button type="button" className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/60" onClick={resetDuration}>Reset</button>
                    {durationRunning ? <span className="text-xs text-muted-foreground">running…</span> : null}
                  </div>

                  <div className="pt-1">
                    <button className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40" onClick={() => submitQuick("duration")} disabled={!ready || quickSubmitting || !subjectId.trim() || !quickDate}>
                      {quickSubmitting ? "Submitting…" : "Submit duration"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Quick entry supports measurement types <code>count</code> and <code>duration</code>.
                </div>
              )}
            </div>
          );
        })() : (
          <div className="text-sm text-muted-foreground">Select a template version above to enable quick entry.</div>
        )}
      </div>

      <div className="space-y-2">
        {historyRows.length ? (
          historyRows.map((r: any) => (
            <div key={r.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold">{r.occurred_at}</div>
                <div className="text-xs text-muted-foreground">{r.template_version_id}</div>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-2 text-[11px]">
                {JSON.stringify(r.data, null, 2)}
              </pre>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No entries loaded.</div>
        )}
      </div>
    </div>
  );
}
