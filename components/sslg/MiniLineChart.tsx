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
  const PAD_BOTTOM = 78; // room for rotated date labels + xLabel
  const PAD_LEFT = 40;

  // Axes (SVG coords)
  const Y_AXIS_X = PAD_LEFT;
  const X_AXIS_Y = H - PAD_BOTTOM;

  // Plot region (data points)
  const PLOT_X0 = Y_AXIS_X + 18; // keep first point off the Y-axis (ABA convention)
  const PLOT_X1 = W - PAD_RIGHT;
  const PLOT_Y0 = PAD_TOP;
  const PLOT_Y1 = X_AXIS_Y;

  const ys = pts.map((p) => p.y);

  const hasYMin = typeof yMin === "number" && Number.isFinite(yMin);
  const hasYMax = typeof yMax === "number" && Number.isFinite(yMax);

  let minY = hasYMin ? (yMin as number) : Math.min(...ys);
  let maxY = hasYMax ? (yMax as number) : Math.max(...ys);

  // Only apply includeZero when user didn't explicitly set Y-min.
  if (includeZero && !hasYMin) minY = Math.min(0, minY);

  // Normalize if user enters inverted bounds
  if (minY > maxY) [minY, maxY] = [maxY, minY];

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  // ----------------------------
  // X domain (index axis)
  // xMin/xMax define what number appears under the first/last point.
  // If unset, defaults to 1..N.
  // ----------------------------
  const hasXMin = typeof xMin === "number" && Number.isFinite(xMin);
  const hasXMax = typeof xMax === "number" && Number.isFinite(xMax);

  let minX = hasXMin ? (xMin as number) : 1;
  let maxX = hasXMax ? (xMax as number) : minX + Math.max(0, pts.length - 1);

  // If only one bound provided, derive the other from point count.
  if (hasXMin && !hasXMax) maxX = minX + Math.max(0, pts.length - 1);
  if (!hasXMin && hasXMax) minX = maxX - Math.max(0, pts.length - 1);

  // Normalize if inverted
  if (minX > maxX) [minX, maxX] = [maxX, minX];

  const xSpan = Math.max(1e-9, maxX - minX);

  function tForIndex(i: number): number {
    if (pts.length <= 1) return 0;
    return i / (pts.length - 1);
  }

  function xValueForIndex(i: number): number {
    // Linear mapping so first point is xMin and last point is xMax
    const t = tForIndex(i);
    return minX + t * (maxX - minX);
  }

  function xForIndex(i: number): number {
    const t = tForIndex(i);
    return PLOT_X0 + t * (PLOT_X1 - PLOT_X0);
  }

  // Major tick values along X
  const hasXTickStep = typeof xTickStep === "number" && Number.isFinite(xTickStep) && (xTickStep as number) > 0;

  function xTickValues(): number[] {
    const MAX_TICKS = 9;

    if (!hasXTickStep) {
      // default: endpoints + evenly spaced ticks (like Y does when no step is set)
      const n = pts.length;
      if (n <= 1) return [minX];
      const k = Math.min(5, n);
      const out: number[] = [];
      for (let j = 0; j < k; j++) {
        const v = minX + (j * (maxX - minX)) / (k - 1);
        out.push(v);
      }
      return out;
    }

    const step = xTickStep as number;
    const out: number[] = [];

    // Always include bounds
    out.push(minX);

    // Step ticks between bounds
    const start = Math.ceil(minX / step) * step;
    for (let v = start; v < maxX; v += step) out.push(v);

    out.push(maxX);

    // Dedup + sort
    const uniq = Array.from(new Set(out.map((v) => Number(v.toFixed(10))))).sort((a, b) => a - b);

    // Downsample if too many
    if (uniq.length <= MAX_TICKS) return uniq;

    const sampled: number[] = [];
    for (let j = 0; j < MAX_TICKS; j++) {
      const idx = Math.round((j * (uniq.length - 1)) / (MAX_TICKS - 1));
      sampled.push(uniq[idx]);
    }
    return Array.from(new Set(sampled)).sort((a, b) => a - b);
  }

  function xPosForValue(v: number): number {
    const t = (v - minX) / xSpan;
    return PLOT_X0 + t * (PLOT_X1 - PLOT_X0);
  }

  function xFor(i: number) {
    if (pts.length === 1) return (PLOT_X0 + PLOT_X1) / 2;
    return PLOT_X0 + (i * (PLOT_X1 - PLOT_X0)) / (pts.length - 1);
  }

  function yFor(y: number) {
    const t = (y - minY) / (maxY - minY);
    return PLOT_Y0 + (1 - t) * (PLOT_Y1 - PLOT_Y0);
  }

  function xTickIdxs(): number[] {
    const n = pts.length;
    if (n <= 1) return [0];

    // Aim: ~1 labeled tick per ~140px, clamped to [3..9]
    const maxTicks = Math.max(3, Math.min(9, Math.floor(W / 140)));

    if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);

    const idxs: number[] = [];
    for (let k = 0; k < maxTicks; k++) {
      idxs.push(Math.round((k * (n - 1)) / (maxTicks - 1)));
    }

    const seen = new Set<number>();
    return idxs.filter((i) => (seen.has(i) ? false : (seen.add(i), true))).sort((a, b) => a - b);
  }

  function fmtTick(v: number) {
    if (!Number.isFinite(v)) return "";
    const iv = Math.round(v);
    if (Math.abs(v - iv) < 1e-6) return String(iv);
    return String(Number(v.toFixed(2))); // trims trailing zeros via Number(...)
  }

  const hasYTickStep = typeof yTickStep === "number" && Number.isFinite(yTickStep) && (yTickStep as number) > 0;

  const yTicks = (() => {
    // Default behavior: 3 ticks (max/mid/min)
    if (!hasYTickStep) {
      return [maxY, (minY + maxY) / 2, minY].map((v) => ({
        v,
        y: yFor(v),
        label: fmtTick(v),
      }));
    }

    const step = yTickStep as number;
    const eps = Math.max(1e-9, step * 1e-9);

    // Build all ticks at step intervals from minY upward (cap to avoid pathological cases)
    const all: number[] = [];
    const maxSteps = 5000;
    for (let i = 0; i <= maxSteps; i++) {
      const v = minY + i * step;
      if (v > maxY + eps) break;
      all.push(v);
    }

    // Ensure bounds are represented even if they don't align to step.
    all.push(maxY);
    all.push(minY);

    // Dedup with rounding (reduce floating drift)
    const uniqAsc = Array.from(new Set(all.map((v) => Number(v.toFixed(10))))).sort((a, b) => a - b);

    // Downsample if too many labels for the small chart
    const MAX_TICKS = 9;
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
    if (!segments.length) return [] as { x: number; y: number; text: string }[];

    // Phase boundaries: Y-axis, each dashed marker X, plot end.
    // This centers labels within phase spans even when a phase has 1 data point.
    const markerXs = markerPos
      .map((m) => m.x)
      .slice()
      .sort((a, b) => a - b);

    const boundaries = [Y_AXIS_X, ...markerXs, PLOT_X1];

    const labels = segments.map((s) => {
      const text = s.label ? `${s.phase} (${s.label})` : s.phase;
      return text.trim();
    });

    const n = Math.min(labels.length, Math.max(0, boundaries.length - 1));
    const out: { x: number; y: number; text: string }[] = [];

    for (let i = 0; i < n; i++) {
      const x0 = boundaries[i];
      const x1 = boundaries[i + 1];
      const spanW = x1 - x0;

      const text = labels[i];
      if (!text) continue;

      const xMid = (x0 + x1) / 2;

      // Only stagger when spans are narrow (dense phase changes).
      const y = PAD_TOP + 10 + (spanW < 120 ? (i % 3) * 10 : 0);

      out.push({ x: xMid, y, text });
    }

    return out;
  })();

  // Phase label spans: center labels between phase boundaries (plot start → marker(s) → plot end)
  const phaseLabelSpans = (() => {
    const boundaries = [PLOT_X0, ...markerPos.map((m) => m.x), PLOT_X1];
    const labels = phaseLabelPos.map((p) => p.text);

    const spans: { x: number; y: number; text: string }[] = [];
    const n = Math.min(labels.length, Math.max(0, boundaries.length - 1));

    for (let i = 0; i < n; i++) {
      const x = (boundaries[i] + boundaries[i + 1]) / 2;
      const y = PAD_TOP + 10 + (i % 3) * 10; // stagger to reduce overlap in narrow phases
      spans.push({ x, y, text: labels[i] });
    }
    return spans;
  })();

  // Build path(s): one per segment if breaking is enabled; otherwise one path
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

      <div className="mt-2 w-full aspect-[16/6]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          role="img"
          aria-label={title}
        >
          {/* axes */}
          <path d={`M ${Y_AXIS_X} ${X_AXIS_Y} H ${W - PAD_RIGHT}`} fill="none" stroke="currentColor" opacity="0.2" />
          <path d={`M ${Y_AXIS_X} ${PAD_TOP} V ${X_AXIS_Y}`} fill="none" stroke="currentColor" opacity="0.2" />

          {/* X ticks: minor tick per point (cap at 250 for perf) */}
          {pts.slice(0, 250).map((_, i) => {
            const x = xForIndex(i);
            return (
              <path
                key={`xt-min-${i}`}
                d={`M ${x.toFixed(2)} ${X_AXIS_Y} V ${(X_AXIS_Y + 3).toFixed(2)}`}
                fill="none"
                stroke="currentColor"
                opacity="0.25"
              />
            );
          })}

          {/* X ticks: labeled major ticks (numeric index axis) */}
          {xTickValues().map((v, i) => {
            const x = xPosForValue(v);
            const yText = X_AXIS_Y + 20;

            // Slant labels down-right; keep baseline constant
            const rotate = 30;
            const anchor = "start";

            return (
              <g key={`xt-${i}`} opacity="0.7">
                <path
                  d={`M ${x.toFixed(2)} ${X_AXIS_Y} V ${(X_AXIS_Y + 7).toFixed(2)}`}
                  fill="none"
                  stroke="currentColor"
                />
                <text
                  x={x}
                  y={yText}
                  fontSize="10"
                  fill="currentColor"
                  textAnchor={anchor}
                  transform={`rotate(${rotate} ${x} ${yText})`}
                >
                  {fmtTick(v)}
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

          {/* Axis labels (inside SVG) */}
          {yLabel ? (
            <text
              x={PAD_LEFT - 28}
              y={(PLOT_Y0 + PLOT_Y1) / 2}
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
              textAnchor="middle"
              transform={`rotate(-90 ${PAD_LEFT - 28} ${(PLOT_Y0 + PLOT_Y1) / 2})`}
            >
              {yLabel}
            </text>
          ) : null}

          {xLabel ? (
            <text
              x={(PLOT_X0 + PLOT_X1) / 2}
              y={H - 10}
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
              textAnchor="middle"
            >
              {xLabel}
            </text>
          ) : null}

          {
          /* phase labels (centered in each phase segment) */}
          {phaseLabelSpans.map((p, i) => (
            <text
              key={`phase-label-${i}`}
              x={p.x}
              y={p.y}
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
              textAnchor="middle"
            >
              {p.text}
            </text>
          ))}

          {/* phase labels (centered in each phase span) */}
          {phaseLabelPos.map((p, i) => (
            <text
              key={`phase-label-${i}`}
              x={p.x}
              y={p.y}
              fontSize="10"
              fill="currentColor"
              opacity="0.7"
              textAnchor="middle"
            >
              {p.text}
            </text>
          ))}

          {/* series (broken at phase changes if enabled) */}
          {paths.map((d, i) => (
            <path key={`seg-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="2" />
          ))}
          {pts.map((p, i) => (
            <circle key={i} cx={xForIndex(i)} cy={yFor(p.y)} r="2.5" fill="currentColor" />
          ))}
        </svg>
      </div>

      <div className="mt-1 flex items-center justify-center text-[11px] text-muted-foreground">
        <span>
          Y: {fmtTick(minY)}{ySuffix || ""} … {fmtTick(maxY)}{ySuffix || ""}
        </span>
      </div>

      {xMode === "trial" ? (
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      ) : null}

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
