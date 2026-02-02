"use client";

import FormsBuilderPage from "@/components/forms/FormsBuilderPage";

export default function BehaviorMeasuresPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 overflow-x-hidden">
      <div className="text-lg font-semibold">Behavior · Define measures</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Build JSON Schema templates for data capture. These templates feed Capture and SSLG.
      </div>

      <div className="mt-6">
        <FormsBuilderPage defaultLifeSwitchDomain="behavior" />
      </div>
    </div>
  );
}
