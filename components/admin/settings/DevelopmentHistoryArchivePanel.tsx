"use client";

type AdminAccess = {
  role: "owner" | "admin";
  role_label: "Owner" | "Admin";
};

type ArchiveStatus = {
  label: string;
  value: string;
  detail: string;
  tone: "ready" | "waiting" | "locked";
};

const ARCHIVE_STATUSES: ArchiveStatus[] = [
  {
    label: "Original source",
    value: "Preserved locally",
    detail: "The first export remains immutable and outside production systems.",
    tone: "ready",
  },
  {
    label: "Current source",
    value: "Waiting for export",
    detail: "The new OpenAI ZIP has not been registered or compared.",
    tone: "waiting",
  },
  {
    label: "Comparison gate",
    value: "Ready",
    detail: "The deterministic synthetic gate passed 22 tests twice.",
    tone: "ready",
  },
  {
    label: "Semantic processing",
    value: "Locked",
    detail: "Classification and episode extraction require source comparison and approval.",
    tone: "locked",
  },
  {
    label: "Search index",
    value: "Not created",
    detail: "No embeddings, vector collection, or retrieval integration exists.",
    tone: "locked",
  },
  {
    label: "Backend connection",
    value: "Quarantined",
    detail: "This panel makes no backend request and receives no archive content.",
    tone: "locked",
  },
];

const WORKFLOW = [
  "Register the untouched ZIP and record its source hash.",
  "Inventory conversations, messages, attachments, gaps, and duplicate exports.",
  "Compare the new snapshot with the preserved original snapshot.",
  "Review privacy candidates, exclusions, contradictions, and missing evidence.",
  "Approve or reject semantic processing as a separate decision.",
];

function statusClass(tone: ArchiveStatus["tone"]): string {
  if (tone === "ready") {
    return "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300";
  }
  if (tone === "waiting") {
    return "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-300";
  }
  return "border-muted/50 bg-muted/30 text-muted-foreground";
}

export function DevelopmentHistoryArchivePanel({
  access,
}: {
  access: AdminAccess;
}) {
  if (access.role !== "owner") {
    return (
      <div className="rounded-xl border border-muted/30 bg-muted/10 p-4">
        <div className="text-sm font-semibold">Owner access required</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Historical exports can contain private account material. Delegated
          administrators cannot view archive status or operate archive controls.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold">
            Fractal Monism Development History Archive
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            A separate historical evidence source showing how ideas were created,
            questioned, corrected, rejected, and refined. Historical wording is
            not current philosophical authority.
          </div>
        </div>
        <span className="rounded-full border border-amber-600/30 bg-amber-600/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Backend quarantine active
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl border border-muted/30 bg-muted/30 sm:grid-cols-2">
        {ARCHIVE_STATUSES.map((status) => (
          <div key={status.label} className="bg-background p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold">{status.label}</div>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status.tone)}`}
              >
                {status.value}
              </span>
            </div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              {status.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <section>
          <div className="text-sm font-semibold">Controlled intake sequence</div>
          <ol className="mt-3 space-y-3">
            {WORKFLOW.map((step, index) => (
              <li key={step} className="flex gap-3 text-xs leading-5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted/50 text-[11px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-muted/30 bg-muted/10 p-4">
          <div className="text-sm font-semibold">Authority boundary</div>
          <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            <p>The raw export remains the archive of record.</p>
            <p>
              Historical evidence cannot override current Fractal Monism,
              governed Memory, ordinary retrieval, or runtime behavior.
            </p>
            <p>
              Every processing stage requires provenance, excluded-source
              accounting, and an explicit approval gate.
            </p>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted/20 pt-4">
        <div className="max-w-xl text-xs leading-5 text-muted-foreground">
          Import remains disabled while the backend is quarantined. No archive
          bytes, file names, hashes, or private content are sent to this page.
        </div>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-lg border border-muted/40 bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground opacity-70"
        >
          Import export unavailable
        </button>
      </div>
    </div>
  );
}
