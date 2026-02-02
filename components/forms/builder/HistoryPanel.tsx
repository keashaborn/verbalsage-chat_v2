"use client";

import * as React from "react";
import ChartPanel from "@/components/forms/builder/ChartPanel";
import PhaseMarkersPanel from "@/components/forms/builder/PhaseMarkersPanel";
import CleanupPanel from "@/components/forms/builder/CleanupPanel";

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

      <PhaseMarkersPanel
        ready={ready}
        phaseLoading={phaseLoading}
        loadPhases={loadPhases}
        historyTemplateVersionId={historyTemplateVersionId}
        phaseDate={phaseDate}
        setPhaseDate={setPhaseDate}
        phaseLabel={phaseLabel}
        setPhaseLabel={setPhaseLabel}
        phaseNotes={phaseNotes}
        setPhaseNotes={setPhaseNotes}
        submitPhaseMarker={submitPhaseMarker}
        phaseSubmitting={phaseSubmitting}
        phaseStatus={phaseStatus}
        subjectId={subjectId}
      />

      <CleanupPanel
        ready={ready}
        cleanupN={cleanupN}
        setCleanupN={setCleanupN}
        cleanupCandidates={cleanupCandidates}
        cleanupConfirm={cleanupConfirm}
        setCleanupConfirm={setCleanupConfirm}
        cleanupNotes={cleanupNotes}
        setCleanupNotes={setCleanupNotes}
        bulkVoidCandidates={bulkVoidCandidates}
        cleanupSubmitting={cleanupSubmitting}
        cleanupStatus={cleanupStatus}
        subjectId={subjectId}
        historyTemplateVersionId={historyTemplateVersionId}
        extractUuid={extractUuid}
      />

      <ChartPanel
        historyTemplateVersionId={historyTemplateVersionId}
        historyVersion={historyVersion}
        historyXMode={historyXMode}
        durationSeries={durationSeries}
        countSeries={countSeries}
        phaseStarts={phaseStarts}
      />
    </div>
  );
}
