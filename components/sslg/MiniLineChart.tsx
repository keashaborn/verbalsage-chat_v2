"use client";

import * as React from "react";

export type XYPoint = { x: string; y: number };
export type XMarker = { x: string; label?: string };
export type PhaseStart = { x: string; phase: string; label?: string };

function shortDay(x: string) {
  const s = String(x || "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtTick(v: number) {
  if (!Number.isFinite(v)) return "";
  const iv = Math.round(v);
  if (Math.abs(v - iv) < 1e-6) return String(iv);
  return String(Number(v.toFixed(2)));
}

export function MiniLineChart({
  title,
  series,
  ySuffix,
  xMode = "trial", // "trial" is the canonical ABA axis; "date" only affects legend
  includeZero = true,
  markers,
  phases,
  breakAtPhaseChange = true,
  xLabel,
  xMin,
  xMax,
  xTickStep,
  yLabel,
  yMin,
  yMax,
  yTickStep,
  heightPx = 240,
  widthPx = 720,
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
  xMin?: number | null;
  xMax?: number | null;
  xTickStep?: number | null;
  yLabel?: string;
  yMin?: number | null;
  yMax?: number | null;
  yTickStep?: number | null;
  heightPx?: number;
  widthPx?: number;
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

  const W = widthPx;
  const H = heightPx;

  // Padding tuned so ticks + axis labels render inside the SVG viewBox.
  const PAD_TOP = 12;
  const PAD_RIGHT = 12;
  const PAD_BOTTOM = 78; // room for x ticks + x label + legend
  const PAD_LEFT = 52; // room for y tick labels + y label

  // Axes (SVG coords)
  const Y_AXIS_X = PAD_LEFT;
  const X_AXIS_Y = H - PAD_BOTTOM;

  // Plot region
  const PLOT_X0 = Y_AXIS_X + 18; // keep first data point off the Y-axis (ABA convention)
  const PLOT_X1 = W - PAD_RIGHT;
  const PLOT_Y0 = PAD_TOP;
  const PLOT_Y1 = X_AXIS_Y;

  // ----------------------------
  // Y domain
  // ----------------------------
  const ys = pts.map((p) => p.y);
  const hasYMin = typeof yMin === "number" && Number.isFinite(yMin);
  const hasYMax = typeof yMax === "number" && Number.isFinite(yMax);

  let minY = hasYMin ? (yMin as number) : Math.min(...ys);
  let maxY = hasYMax ? (yMax as number) : Math.max(...ys);

  // Only apply includeZero when user didn't explicitly set Y-min.
  if (includeZero && !hasYMin) minY = Math.min(0, minY);

  // Normalize if inverted
  if (minY > maxY) [minY, maxY] = [maxY, minY];

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  function yFor(y: number) {
    const t = (y - minY) / (maxY - minY);
    return PLOT_Y0 + (1 - t) * (PLOT_Y1 - PLOT_Y0);
  }

  const hasYTickStep =
    typeof yTickStep === "number" && Number.isFinite(yTickStep) && (yTickStep as number) > 0;

  const yTicks = (() => {
    if (!hasYTickStep) {
      return [maxY, (minY + maxY) / 2, minY].map((v) => ({ v, y: yFor(v), label: fmtTick(v) }));
    }

    const step = yTickStep as number;
    const eps = Math.max(1e-9, step * 1e-9);

    const all: number[] = [];
    const maxSteps = 2000;
    for (let i = 0; i <= maxSteps; i++) {
      const v = minY + i * step;
      if (v > maxY + eps) break;
      all.push(v);
    }
    all.push(minY, maxY);

    const uniqAsc = Array.from(new Set(all.map((v) => Number(v.toFixed(10))))).sort((a, b) => a - b);

    const MAX_TICKS = 11;
    let vals = uniqAsc;
    if (vals.length > MAX_TICKS) {
      const sampled: number[] = [];
      for (let j = 0; j < MAX_TICKS; j++) {
        const idx = Math.round((j * (vals.length - 1)) / (MAX_TICKS - 1));
        sampled.push(vals[idx]);
      }
      vals = Array.from(new Set(sampled)).sort((a, b) => a - b);
    }

    return vals.map((v) => ({ v, y: yFor(v), label: fmtTick(v) }));
  })();

  // ----------------------------
  // X domain (numeric index axis)
  // xMin/xMax define numbers under first/last point. Defaults to 1..N.
  // ----------------------------
  const hasXMin = typeof xMin === "number" && Number.isFinite(xMin);
  const hasXMax = typeof xMax === "number" && Number.isFinite(xMax);

  let minX = hasXMin ? (xMin as number) : 1;
  // If xMax is not provided, end exactly at the last point (minX + (N-1)).
  // If xMax IS provided, allow blank space to the right of the last point.
  let maxX = hasXMax ? (xMax as number) : minX + Math.max(0, pts.length - 1);

  // If only xMax was provided, back-compute xMin so the last point lands at xMax.
  if (!hasXMin && hasXMax) {
    minX = maxX - Math.max(0, pts.length - 1);
  }

  if (minX > maxX) [minX, maxX] = [maxX, minX];

  const xSpan = Math.max(1e-9, maxX - minX);

  // Point-to-X mapping (ABA-style index axis):
  // each successive point advances by +1 on the X axis.
  // xMax (if provided) just sets the visible right edge (may extend past last point).
  function xValueForIndex(i: number): number {
    return minX + i;
  }

  function xForIndex(i: number): number {
    return xPosForValue(xValueForIndex(i));
  }

  const hasXTickStep =
    typeof xTickStep === "number" && Number.isFinite(xTickStep) && (xTickStep as number) > 0;

  function xTickValues(): number[] {
    const step = typeof xTickStep === "number" && Number.isFinite(xTickStep) && xTickStep > 0 ? xTickStep : null;

    // If no explicit step: keep a small set of evenly spaced labels.
    if (!step) {
      const n = pts.length;
      if (n <= 1) return [minX];
      const k = Math.min(7, n); // a few labels
      const out: number[] = [];
      for (let j = 0; j < k; j++) {
        const v = minX + (j * (maxX - minX)) / (k - 1);
        out.push(v);
      }
      return out;
    }

    // If explicit step: show the exact integer sequence the user asked for,
    // but cap to avoid unreadable label density.
    const span = maxX - minX;
    const count = Math.floor(span / step) + 1;

    // If <= 40 labels, show them all (1..30 at step=1 will show all).
    const MAX_LABELS = 40;

    // If too many labels, skip labels but keep tick marks (minor ticks already render).
    const stride = count <= MAX_LABELS ? 1 : Math.ceil(count / MAX_LABELS);

    const out: number[] = [];
    for (let i = 0; i < count; i += stride) {
      out.push(minX + i * step);
    }

    // Ensure exact endpoints are present.
    if (out.length === 0 || Math.abs(out[0] - minX) > 1e-9) out.unshift(minX);
    const last = out[out.length - 1];
    if (Math.abs(last - maxX) > 1e-9) out.push(maxX);

    // Dedup + sort
    return Array.from(new Set(out.map((v) => Number(v.toFixed(10))))).sort((a, b) => a - b);
  }

  function xPosForValue(v: number): number {
    const t = (v - minX) / xSpan;
    return PLOT_X0 + t * (PLOT_X1 - PLOT_X0);
  }

  // ----------------------------
  // Phase markers (dashed verticals) + labels
  // ----------------------------
  const phaseStarts = Array.isArray(phases) ? phases : [];

  // Dashed verticals: prefer explicit markers; otherwise from phase starts (skip first).
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

  // markerPos are the x pixel positions of phase changes (between points)
  const markerPos = (() => {
    const ms = Array.isArray(phaseChangeMarkers) ? phaseChangeMarkers : [];
    const out: { x: number; label: string }[] = [];
    for (const m of ms) {
      const day = shortDay(m?.x || "");
      if (!day) continue;

      const idx = idxForDay(day);
      if (idx <= 0) continue;

      const x = (xForIndex(idx - 1) + xForIndex(idx)) / 2;
      out.push({ x, label: String(m?.label || "").trim() });
    }
    return out;
  })();

  // Phase label text in phase order (using provided phase starts if available)
  const phaseLabelTexts = (() => {
    if (!phaseStarts.length) return [] as string[];

    // Phase starts should already be in chronological order; if not, sort by date string.
    const tmp = phaseStarts
      .map((p) => ({
        x: shortDay(p?.x || ""),
        phase: String(p?.phase || "").trim(),
        label: String(p?.label || "").trim(),
      }))
      .filter((p) => p.x && p.phase)
      .sort((a, b) => a.x.localeCompare(b.x));

    if (!tmp.length) return [] as string[];

    // Collapse to "starts" sequence (keep order, allow duplicates if user explicitly does)
    return tmp.map((p) => (p.label ? `${p.phase} (${p.label})` : p.phase));
  })();

  // Center labels between boundaries (plot start -> marker(s) -> plot end).
  const phaseLabelSpans = (() => {
    if (!phaseLabelTexts.length) return [] as { x: number; y: number; text: string }[];

    const boundaries = [PLOT_X0, ...markerPos.map((m) => m.x), PLOT_X1];
    const n = Math.min(phaseLabelTexts.length, Math.max(0, boundaries.length - 1));

    const out: { x: number; y: number; text: string }[] = [];
    for (let i = 0; i < n; i++) {
      const xMid = (boundaries[i] + boundaries[i + 1]) / 2;
      const y = PAD_TOP + 10 + (i % 3) * 10; // stagger to reduce overlap when phases are narrow
      out.push({ x: xMid, y, text: phaseLabelTexts[i] });
    }
    return out;
  })();

  // ----------------------------
  // Series path (optionally broken at phase changes)
  // ----------------------------
  const cutIdxs = (() => {
    if (!breakAtPhaseChange) return [] as number[];
    const out: number[] = [];
    // convert marker positions back to cut indices using idxForDay logic
    for (const m of phaseChangeMarkers) {
      const idx = idxForDay(shortDay(m?.x || ""));
      if (idx > 0) out.push(idx);
    }
    out.sort((a, b) => a - b);
    return out.filter((v, i) => i === 0 || v !== out[i - 1]);
  })();

  const paths = (() => {
    if (!cutIdxs.length) {
      const d = pts
        .map((p, i) => {
          const x = xForIndex(i);
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
        const x = xForIndex(i);
        const y = yFor(pts[i].y);
        parts.push(`${i === r.start ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      out.push(parts.join(" "));
    }
    return out.length ? out : [];
  })();

  // Legend
  const last = pts[pts.length - 1]?.y;
  const dateLegend =
    xMode === "date"
      ? `Dates: ${shortDay(pts[0]?.x)} … ${shortDay(pts[pts.length - 1]?.x)}`
      : `Trials: ${fmtTick(minX)} … ${fmtTick(maxX)}`;

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">
          n={pts.length} · last={Number.isFinite(last) ? last : "?"}
          {ySuffix || ""}
        </div>
      </div>

      <div className="mt-2 w-full aspect-[16/6]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={title}>
          {/* axes */}
          <path d={`M ${Y_AXIS_X} ${X_AXIS_Y} H ${W - PAD_RIGHT}`} fill="none" stroke="currentColor" opacity="0.2" />
          <path d={`M ${Y_AXIS_X} ${PAD_TOP} V ${X_AXIS_Y}`} fill="none" stroke="currentColor" opacity="0.2" />

          {/* X ticks: minor ticks at each integer unit (cap range for perf) */}
          {(() => {
            const span = Math.abs(maxX - minX);
            if (!Number.isFinite(span) || span > 200) return null;

            const a = Math.ceil(Math.min(minX, maxX));
            const b = Math.floor(Math.max(minX, maxX));

            const out: JSX.Element[] = [];
            for (let v = a; v <= b; v++) {
              const x = xPosForValue(v);
              out.push(
                <path
                  key={`xt-min-${v}`}
                  d={`M ${x.toFixed(2)} ${X_AXIS_Y} V ${(X_AXIS_Y + 3).toFixed(2)}`}
                  fill="none"
                  stroke="currentColor"
                  opacity="0.25"
                />
              );
            }
            return out;
          })()}

          {/* X ticks: labeled major ticks (numeric) */}
          {xTickValues().map((v, i) => {
            const x = xPosForValue(v);
            const yText = X_AXIS_Y + 20;
            return (
              <g key={`xt-${i}`} opacity="0.7">
                <path d={`M ${x.toFixed(2)} ${X_AXIS_Y} V ${(X_AXIS_Y + 7).toFixed(2)}`} fill="none" stroke="currentColor" />
                <text x={x} y={yText} fontSize="10" fill="currentColor" textAnchor="middle">
                  {String(Math.round(v))}
                </text>
              </g>
            );
          })}

          {/* Y ticks */}
          {yTicks.map((t, idx) => (
            <g key={`yt-${idx}`} opacity="0.6">
              <path d={`M ${Y_AXIS_X - 4} ${t.y} H ${Y_AXIS_X}`} fill="none" stroke="currentColor" />
              <text x={Y_AXIS_X - 6} y={t.y + 3} fontSize="10" fill="currentColor" textAnchor="end">
                {t.label}
              </text>
            </g>
          ))}

          {/* Phase labels */}
          {phaseLabelSpans.map((p, i) => (
            <text
              key={`phase-label-${i}`}
              x={p.x}
              y={p.y}
              fontSize="10"
              fill="currentColor"
              opacity="0.75"
              textAnchor="middle"
            >
              {p.text}
            </text>
          ))}

          {/* Phase change markers (dashed verticals) */}
          {markerPos.map((m, i) => (
            <g key={`phase-${i}`} opacity="0.6">
              <path
                d={`M ${m.x.toFixed(2)} ${PAD_TOP} V ${X_AXIS_Y}`}
                fill="none"
                stroke="currentColor"
                strokeDasharray="4 3"
              />
            </g>
          ))}

          {/* Axis labels (inside SVG) */}
          {yLabel ? (
            <text
              x={PAD_LEFT - 32}
              y={(PLOT_Y0 + PLOT_Y1) / 2}
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
              textAnchor="middle"
              transform={`rotate(-90 ${PAD_LEFT - 32} ${(PLOT_Y0 + PLOT_Y1) / 2})`}
            >
              {yLabel}
            </text>
          ) : null}

          {xLabel ? (
            <text x={(PLOT_X0 + PLOT_X1) / 2} y={H - 10} fontSize="10" fill="currentColor" opacity="0.7" textAnchor="middle">
              {xLabel}
            </text>
          ) : null}

          {/* series */}
          {paths.map((d, i) => (
            <path key={`seg-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="2" />
          ))}
          {pts.map((p, i) => (
            <circle key={i} cx={xForIndex(i)} cy={yFor(p.y)} r="2.5" fill="currentColor" />
          ))}
        </svg>
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground">{dateLegend}</div>
    </div>
  );
}
