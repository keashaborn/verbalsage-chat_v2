"use client";

export type PublishPanelProps = {
  ready: boolean;

  publish: () => void;
  publishing: boolean;

  name: string;
  setName: (v: string) => void;

  templateId: string;
  setTemplateId: (v: string) => void;

  lastVersionId: string;

  schemaText: string;
  setSchemaText: (v: string) => void;

  uiSchemaText: string;
  setUiSchemaText: (v: string) => void;

  metadataText: string;
  setMetadataText: (v: string) => void;

  publishStatus: string;
};

export default function PublishPanel(p: PublishPanelProps) {
  const {
    ready,
    publish,
    publishing,
    name,
    setName,
    templateId,
    setTemplateId,
    lastVersionId,
    schemaText,
    setSchemaText,
    uiSchemaText,
    setUiSchemaText,
    metadataText,
    setMetadataText,
    publishStatus,
  } = p;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Publish</div>
        <button
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={publish}
          disabled={!ready || publishing}
        >
          {publishing ? "Publishing…" : "Publish"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Name</div>
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Template ID (optional)</div>
        <div className="text-xs text-muted-foreground">
          Leave blank to create a new template. If set, Publish creates a new version.
        </div>
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          placeholder="uuid"
        />
        {lastVersionId ? (
          <div className="text-xs text-muted-foreground">Last version_id: {lastVersionId}</div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">JSON Schema</div>
        <textarea
          className="h-72 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">UI Schema (optional)</div>
        <textarea
          className="h-28 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          value={uiSchemaText}
          onChange={(e) => setUiSchemaText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Metadata (optional)</div>
        <textarea
          className="h-24 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          value={metadataText}
          onChange={(e) => setMetadataText(e.target.value)}
        />
      </div>

      {publishStatus ? <div className="text-sm text-muted-foreground">{publishStatus}</div> : null}
    </div>
  );
}
