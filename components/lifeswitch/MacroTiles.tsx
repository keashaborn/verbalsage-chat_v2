// components/lifeswitch/MacroTiles.tsx
import * as React from "react";

type MacroTilesProps = {
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  variant?: "totals" | "per100g";
  className?: string;
};

function fmt(n: number | null | undefined, decimals: number) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  // drop trailing .0 for cleanliness
  const s = v.toFixed(decimals);
  return decimals > 0 ? s.replace(/\.0$/, "") : String(Math.round(v));
}

function Tile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function MacroTiles({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
  variant = "per100g",
  className = "",
}: MacroTilesProps) {
  const gDecimals = variant === "totals" ? 0 : 1;

  return (
    <div className={`grid grid-cols-4 gap-2 text-sm ${className}`}>
      <Tile label="kcal" value={fmt(kcal, 0)} />
      <Tile label="P" value={fmt(protein_g, gDecimals)} />
      <Tile label="C" value={fmt(carbs_g, gDecimals)} />
      <Tile label="F" value={fmt(fat_g, gDecimals)} />
    </div>
  );
}

// Optional: helpers you can import for math (keeps the page cleaner)
export function scalePer100g(
  per100g: { kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null },
  qty_g: number,
) {
  const f = qty_g / 100.0;
  return {
    kcal: (per100g.kcal ?? 0) * f,
    protein_g: (per100g.protein_g ?? 0) * f,
    carbs_g: (per100g.carbs_g ?? 0) * f,
    fat_g: (per100g.fat_g ?? 0) * f,
  };
}
