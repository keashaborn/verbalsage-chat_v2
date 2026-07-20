"use client";

import * as React from "react";

export type MeasurementDatePoint = {
  id: string;
  date: string;
  value: number;
};

function dateNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year || 1970, Math.max(0, (month || 1) - 1), day || 1);
}

function shortDate(date: string): string {
  const value = dateNumber(date);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function numberLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function MeasurementDateChart({
  points,
  unit,
  label,
}: {
  points: MeasurementDatePoint[];
  unit: string;
  label: string;
}) {
  const width = 720;
  const height = 250;
  const left = 54;
  const right = 18;
  const top = 24;
  const bottom = 44;

  const timestamps = points.map((point) => dateNumber(point.date));
  const values = points.map((point) => point.value);
  const firstTime = Math.min(...timestamps);
  const lastTime = Math.max(...timestamps);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = Math.max(
    rawMax - rawMin,
    Math.max(Math.abs(rawMax), 1) * 0.01,
  );
  const yMin = rawMin - rawRange * 0.18;
  const yMax = rawMax + rawRange * 0.18;

  const xFor = (date: string) => {
    if (lastTime === firstTime) return (left + width - right) / 2;
    return (
      left +
      ((dateNumber(date) - firstTime) / (lastTime - firstTime)) *
        (width - left - right)
    );
  };

  const yFor = (value: number) => {
    if (yMax === yMin) return (top + height - bottom) / 2;
    return top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
  };

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(point.date)} ${yFor(point.value)}`,
    )
    .join(" ");

  const middlePoint = points[Math.floor((points.length - 1) / 2)];
  const dateTicks = [points[0], middlePoint, points[points.length - 1]].filter(
    (point, index, all) =>
      point &&
      all.findIndex((candidate) => candidate.date === point.date) === index,
  );

  return (
    <div className="overflow-x-auto">
      <svg
        className="h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label} from ${points[0].date} through ${points[points.length - 1].date}`}
      >
        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          stroke="currentColor"
          opacity="0.22"
        />
        <line
          x1={left}
          y1={top}
          x2={left}
          y2={height - bottom}
          stroke="currentColor"
          opacity="0.22"
        />

        <text
          x={left - 8}
          y={top + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {numberLabel(yMax)}
        </text>
        <text
          x={left - 8}
          y={height - bottom + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {numberLabel(yMin)}
        </text>

        {dateTicks.map((point) => (
          <g key={`tick:${point.date}`}>
            <line
              x1={xFor(point.date)}
              y1={height - bottom}
              x2={xFor(point.date)}
              y2={height - bottom + 6}
              stroke="currentColor"
              opacity="0.35"
            />
            <text
              x={xFor(point.date)}
              y={height - bottom + 22}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {shortDate(point.date)}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={point.id}>
            <circle
              cx={xFor(point.date)}
              cy={yFor(point.value)}
              r="4.5"
              fill="currentColor"
            />
            <title>{`${point.date}: ${numberLabel(point.value)}${unit}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
