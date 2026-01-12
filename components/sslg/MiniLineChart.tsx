"use client";

import * as React from "react";

export type XYPoint = { x: string; y: number };
export type XMarker = { x: string; label?: string };
export type PhaseStart = { x: string; phase: string; label?: string };

function shortDay(x: string) {
  const s = String(x || "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function MiniLineChart({
  title,
  series,
  ySuffix,
  xMode = "trial",
  includeZero = true,
  markers,
  phases,
  breakAtPhaseChange = true,
  xLabel,
  yLabel,
}: {
  title: string;
  series: XYPoint[];
  ySuffix?: string;
  xMode?: "trial" | "date";
  includeZero?: boolean;
  markers?: XMarker[];
  phases?: PhaseStart[];
  breakAtPhaseChange?: boolean;
  xLabel?: string;
  yLabel?: string;
}) {
  const pts = Array.isArray(series) ? series : [];
  if (pts.length === 0) {
    return (
      <div className="rounded-xl border p-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">No data.</div>
      </div>
    );
  }

  const W = 320;
  const H = 160;
  const PAD = 12;

  const ys = pts.map((p) => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (includeZero) minY = Math.min(0, minY);

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  // Keep first data point off the Y-axis (ABA convention)
  const X0 = PAD + 18;
  const X1 = W - PAD;

  function xFor(i: number) {
    if (pts.length === 1) return (X0 + X1) / 2;
    return X0 + (i * (X1 - X0)) / (pts.length - 1);
  }

  function yFor(y: number) {
    const t = (y - minY) / (maxY - minY);
    return PAD + (1 - t) * (H - PAD * 2);
  }

  const yTicks = [maxY, (minY + maxY) / 2, minY].map((v) => ({
    v,
    y: yFor(v),
    label: Number.isFinite(v) ? String(Math.round(v)) : "",
  }));

  // Phase markers: prefer explicit markers prop; otherwise derive from phase starts
  const phaseStarts = Array.isArray(phases) ? phases : [];
  const phaseChangeMarkers: XMarker[] =
    Array.isArray(markers) && markers.length
      ? markers
      : phaseStarts.length > 1
        ? phaseStarts.slice(1).map((p) => ({ x: p.x, label: p.phase }))
        : [];

  function idxForDay(day: string): number {
    if (!day) return -1;
    return pts.findIndex((p) => shortDay(p.x) >= day);
  }

  // Compute phase start indices (for labeling + line breaks)
  const phaseIdx = (() => {
    if (!phaseStarts.length) return [] as { idx: number; phase: string; label: string }[];

    const tmp: { idx: number; phase: string; label: string }[] = [];
    for (const p of phaseStarts) {
      const day = shortDay(p?.x || "");
      if (!day) continue;

      const idx = idxForDay(day);
      if (idx < 0) continue;

      const phase = String(p?.phase || "").trim();
      const label = String(p?.label || "").trim();
      if (!phase && !label) continue;

      tmp.push({ idx, phase, label });
    }

    tmp.sort((a, b) => a.idx - b.idx);

    // Dedup by idx (keep last)
    const byIdx = new Map<number, { idx: number; phase: string; label: string }>();
    for (const it of tmp) byIdx.set(it.idx, it);

    return Array.from(byIdx.values()).sort((a, b) => a.idx - b.idx);
  })();

  // Phase change line positions (dashed verticals)
  const markerPos = (() => {
    const ms = Array.isArray(phaseChangeMarkers) ? phaseChangeMarkers : [];
    const out: { x: number; label: string }[] = [];

    for (const m of ms) {
      const day = shortDay(m?.x || "");
      if (!day) continue;

      const idx = idxForDay(day);
      if (idx <= 0) continue;

      const x = (xFor(idx - 1) + xFor(idx)) / 2;
      out.push({ x, label: String(m?.label || "").trim() });
    }

    return out;
  })();

  // Build cut indices for breaking the line at phase changes
  const cutIdxs = (() => {
    if (!breakAtPhaseChange) return [] as number[];

    const out: number[] = [];

    if (phaseIdx.length > 1) {
      for (const p of phaseIdx.slice(1)) {
        if (p.idx > 0) out.push(p.idx);
      }
    } else {
      for (const m of phaseChangeMarkers) {
        const idx = idxForDay(shortDay(m?.x || ""));
        if (idx > 0) out.push(idx);
      }
    }

    out.sort((a, b) => a - b);
    return out.filter((v, i) => i === 0 || v !== out[i - 1]);
  })();

  // Phase segments (for centered labels)
  const segments = (() => {
    if (!phaseIdx.length) return [] as { start: number; end: number; phase: string; label: string }[];

    function labelForIndex(i: number) {
      let cur = phaseIdx[0];
      for (const p of phaseIdx) {
        if (p.idx <= i) cur = p;
        else break;
      }
      const phase = cur.phase || "";
      const label = cur.label || "";
      return { phase, label };
    }

    const ranges: { start: number; end: number }[] = [];
    let s = 0;
    for (const c of cutIdxs) {
      ranges.push({ start: s, end: Math.max(s, c - 1) });
      s = c;
    }
    ranges.push({ start: s, end: pts.length - 1 });

    const out: { start: number; end: number; phase: string; label: string }[] = [];
    for (const r of ranges) {
      if (r.end < r.start) continue;
      const t = labelForIndex(r.start);
      out.push({ start: r.start, end: r.end, phase: t.phase, label: t.label });
    }
    return out;
  })();

  const phaseLabelPos = (() => {
    if (!segments.length) return [] as { x: number; text: string }[];

    const out: { x: number; text: string }[] = [];
    for (const s of segments) {
      const mid = (xFor(s.start) + xFor(s.end)) / 2;
      const text = s.label ? `${s.phase} (${s.label})` : s.phase;
      if (!text) continue;
      out.push({ x: mid, text });
    }
    return out;
  })();

  // Build path(s): one per segment if breaking is enabled; otherwise one path
  const paths = (() => {
    if (!cutIdxs.length) {
      const d = pts
        .map((p, i) => {
          const x = xFor(i);
          const y = yFor(p.y);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
      return [d];
    }

    const ranges: { start: number; end: number }[] = [];
    let s = 0;
    for (const c of cutIdxs) {
      ranges.push({ start: s, end: Math.max(s, c - 1) });
      s = c;
    }
    ranges.push({ start: s, end: pts.length - 1 });

    const out: string[] = [];
    for (const r of ranges) {
      if (r.end < r.start) continue;
      const parts: string[] = [];
      for (let i = r.start; i <= r.end; i++) {
        const x = xFor(i);
        const y = yFor(pts[i].y);
        parts.push(`${i === r.start ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      out.push(parts.join(" "));
    }
    return out.length ? out : [];
  })();

  const last = pts[pts.length - 1]?.y;

  const leftLabel = xMode === "trial" ? "T1" : shortDay(pts[0]?.x);
  const rightLabel = xMode === "trial" ? `T${pts.length}` : shortDay(pts[pts.length - 1]?.x);
  const secondaryLabel =
    xMode === "trial"
      ? `Dates: ${shortDay(pts[0]?.x)} … ${shortDay(pts[pts.length - 1]?.x)}`
      : `Trials: T1 … T${pts.length}`;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">
          n={pts.length} · last={Number.isFinite(last) ? last : "?"}
          {ySuffix || ""}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full" role="img" aria-label={title}>
        <path d={`M ${PAD} ${H - PAD} H ${W - PAD}`} fill="none" stroke="currentColor" opacity="0.2" />
        <path d={`M ${PAD} ${PAD} V ${H - PAD}`} fill="none" stroke="currentColor" opacity="0.2" />

        {yTicks.map((t, idx) => (
          <g key={idx} opacity="0.6">
            <path d={`M ${PAD - 4} ${t.y} H ${PAD}`} fill="none" stroke="currentColor" />
            <text x={0} y={t.y + 3} fontSize="10" fill="currentColor">
              {t.label}
            </text>
          </g>
        ))}

        {phaseLabelPos.map((p, i) => (
          <text
            key={`phase-label-${i}`}
            x={p.x}
            y={PAD + 10}
            fontSize="10"
            fill="currentColor"
            opacity="0.7"
            textAnchor="middle"
          >
            {p.text}
          </text>
        ))}

        {markerPos.map((m, i) => (
          <g key={`phase-${i}`} opacity="0.6">
            <path
              d={`M ${m.x.toFixed(2)} ${PAD} V ${H - PAD}`}
              fill="none"
              stroke="currentColor"
              strokeDasharray="4 3"
            />
          </g>
        ))}

        {paths.map((d, i) => (
          <path key={`seg-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
        {pts.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.y)} r="2.5" fill="currentColor" />
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{leftLabel}</span>
        <span>
          {minY.toFixed(0)}
          {ySuffix || ""} … {maxY.toFixed(0)}
          {ySuffix || ""}
        </span>
        <span>{rightLabel}</span>
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground">{secondaryLabel}</div>

      {(xLabel || yLabel) ? (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {yLabel ? `Y: ${yLabel}` : null}
          {yLabel && xLabel ? " · " : null}
          {xLabel ? `X: ${xLabel}` : null}
        </div>
      ) : null}
    </div>
  );
}
