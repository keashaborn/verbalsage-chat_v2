"use client";

import * as React from "react";
import { MiniLineChart } from "@/components/sslg/MiniLineChart";

export type ChartPanelProps = {
  historyTemplateVersionId: string;
  historyVersion: any;
  historyXMode: "trial" | "date";
  durationSeries: any[];
  countSeries: any[];
  phaseStarts: any[];
};

export default function ChartPanel({
  historyTemplateVersionId,
  historyVersion,
  historyXMode,
  durationSeries,
  countSeries,
  phaseStarts,
}: ChartPanelProps) {
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
}
