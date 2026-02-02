"use client";

export type PhaseMarkersPanelProps = {
  ready: boolean;
  phaseLoading: boolean;
  loadPhases: () => void;

  historyTemplateVersionId: string;

  phaseDate: string;
  setPhaseDate: (v: string) => void;

  phaseLabel: string;
  setPhaseLabel: (v: string) => void;

  phaseNotes: string;
  setPhaseNotes: (v: string) => void;

  submitPhaseMarker: () => void;
  phaseSubmitting: boolean;
  phaseStatus: string;

  subjectId: string;
};

export default function PhaseMarkersPanel(p: PhaseMarkersPanelProps) {
  const {
    ready,
    phaseLoading,
    loadPhases,
    historyTemplateVersionId,
    phaseDate,
    setPhaseDate,
    phaseLabel,
    setPhaseLabel,
    phaseNotes,
    setPhaseNotes,
    submitPhaseMarker,
    phaseSubmitting,
    phaseStatus,
    subjectId,
  } = p;

  return (
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
        Target template_version_id:{" "}
        <span className="font-mono">{historyTemplateVersionId || "(none selected)"}</span>
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
          disabled={
            !ready ||
            phaseSubmitting ||
            !subjectId.trim() ||
            !historyTemplateVersionId.trim() ||
            !phaseDate.trim() ||
            !phaseLabel.trim()
          }
        >
          {phaseSubmitting ? "Submitting…" : "Submit phase marker"}
        </button>

        {phaseStatus ? <div className="text-xs text-muted-foreground">{phaseStatus}</div> : null}
      </div>
    </div>
  );
}
