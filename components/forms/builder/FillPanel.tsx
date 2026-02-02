"use client";

import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";

export type FillPanelProps = {
  ready: boolean;

  loadTemplates: () => void;
  loadingTemplates: boolean;

  templates: any[];
  selectedVersionId: string;
  loadVersion: (id: string) => void;

  subjectId: string;
  setSubjectId: (v: string) => void;

  version: any;
  formData: any;
  setFormData: (v: any) => void;

  submitEntry: () => void;
  submitting: boolean;

  fillStatus: string;
};

export default function FillPanel(p: FillPanelProps) {
  const {
    ready,
    loadTemplates,
    loadingTemplates,
    templates,
    selectedVersionId,
    loadVersion,
    subjectId,
    setSubjectId,
    version,
    formData,
    setFormData,
    submitEntry,
    submitting,
    fillStatus,
  } = p;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Fill + Submit</div>
        <button
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
          onClick={loadTemplates}
          disabled={!ready || loadingTemplates}
        >
          {loadingTemplates ? "Loading…" : "Load my templates"}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Select template version</div>
        <select
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={selectedVersionId}
          onChange={(e) => loadVersion(e.target.value)}
        >
          <option value="">(choose)</option>
          {templates
            .filter((t: any) => t.latest_version_id)
            .map((t: any) => (
              <option key={t.template_id} value={t.latest_version_id as string}>
                {t.name} (v{t.latest_version ?? "?"})
              </option>
            ))}
        </select>
        <div className="text-xs text-muted-foreground">
          v1 supports primitive fields (string/number/integer/boolean) and enum dropdowns. Arrays/objects beyond 1 level will be unsupported until we add a real schema renderer.
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Subject ID</div>
        <input
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        />
      </div>

      {version ? (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="text-sm font-semibold">
            {(version.json_schema?.title || "Form")} (template_version_id={version.version_id})
          </div>

          <Form
            schema={version.json_schema}
            uiSchema={version.ui_schema || {}}
            validator={validator}
            formData={formData}
            onChange={(e) => setFormData((e as any).formData)}
            onSubmit={() => submitEntry()}
          >
            <div className="pt-2">
              <button
                type="submit"
                className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold hover:bg-muted/60 disabled:opacity-40"
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit entry"}
              </button>
            </div>
          </Form>
        </div>
      ) : null}

      {fillStatus ? <div className="text-sm text-muted-foreground">{fillStatus}</div> : null}
    </div>
  );
}
