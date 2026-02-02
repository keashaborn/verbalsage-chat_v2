"use client";

export type CleanupPanelProps = {
  ready: boolean;

  cleanupN: string;
  setCleanupN: (v: string) => void;

  cleanupCandidates: any[];
  cleanupConfirm: string;
  setCleanupConfirm: (v: string) => void;

  cleanupNotes: string;
  setCleanupNotes: (v: string) => void;

  bulkVoidCandidates: () => void;
  cleanupSubmitting: boolean;
  cleanupStatus: string;

  subjectId: string;
  historyTemplateVersionId: string;
  extractUuid: (s: string) => string | null;
};

export default function CleanupPanel(p: CleanupPanelProps) {
  const {
    ready,
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
    subjectId,
    historyTemplateVersionId,
    extractUuid,
  } = p;

  return (
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
  );
}
