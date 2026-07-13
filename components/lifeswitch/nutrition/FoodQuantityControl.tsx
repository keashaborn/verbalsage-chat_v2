"use client";

import * as React from "react";
import { NumericInput } from "@/components/lifeswitch/NumericInput";

export const GRAMS_UNIT = "grams";

export type FoodServingOption = {
  my_food_serving_id: string;
  my_food_id: string;
  name: string;
  grams: number;
  is_default?: boolean;
  is_active?: boolean;
};

export type FoodQuantitySelection = {
  quantity: string;
  unit: string;
};

export type FoodQuantityPreference = {
  preferred_mode?: "grams" | "serving";
  preferred_quantity?: number | null;
  preferred_serving_id?: string | null;
  preferred_serving_name?: string | null;
  preferred_serving_grams?: number | null;
};

export function servingUnitLabel(name: string): string {
  return String(name || "serving").replace(/^1\s+/i, "").trim() || "serving";
}

export function preferredQuantitySelection(food: FoodQuantityPreference): FoodQuantitySelection {
  const quantity = Number(food.preferred_quantity);
  if (
    food.preferred_mode === "serving" &&
    food.preferred_serving_id &&
    Number.isFinite(quantity) &&
    quantity > 0
  ) {
    return { quantity: String(quantity), unit: food.preferred_serving_id };
  }
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "100",
    unit: GRAMS_UNIT,
  };
}

export function preferredServingSeed(food: FoodQuantityPreference & { my_food_id: string }): FoodServingOption[] {
  if (
    food.preferred_mode !== "serving" ||
    !food.preferred_serving_id ||
    !food.preferred_serving_name ||
    !Number.isFinite(Number(food.preferred_serving_grams)) ||
    Number(food.preferred_serving_grams) <= 0
  ) {
    return [];
  }
  return [{
    my_food_serving_id: food.preferred_serving_id,
    my_food_id: food.my_food_id,
    name: food.preferred_serving_name,
    grams: Number(food.preferred_serving_grams),
    is_default: true,
    is_active: true,
  }];
}

export function resolvedQuantityGrams(
  selection: FoodQuantitySelection,
  servings: FoodServingOption[]
): number | null {
  const quantity = Number(selection.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (selection.unit === GRAMS_UNIT) return quantity;
  const serving = servings.find((row) => row.my_food_serving_id === selection.unit);
  if (!serving || !Number.isFinite(Number(serving.grams)) || Number(serving.grams) <= 0) return null;
  return quantity * Number(serving.grams);
}

type Props = {
  label: string;
  value: FoodQuantitySelection;
  servings: FoodServingOption[];
  onChange: (next: FoodQuantitySelection) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function FoodQuantityControl({
  label,
  value,
  servings,
  onChange,
  disabled = false,
  compact = false,
}: Props) {
  const activeServings = servings.filter((row) => row.is_active !== false);
  return (
    <div className={`grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-2 ${compact ? "max-w-sm" : "w-full"}`}>
      <NumericInput
        className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
        value={value.quantity}
        mode="decimal"
        min={0.001}
        required
        aria-label={`${label} quantity`}
        disabled={disabled}
        onValueChange={(quantity) => onChange({ ...value, quantity })}
      />
      <select
        className="min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
        value={value.unit}
        aria-label={`${label} unit`}
        disabled={disabled}
        onChange={(event) => {
          const unit = event.target.value;
          onChange({
            quantity: unit === GRAMS_UNIT && value.unit !== GRAMS_UNIT
              ? String(resolvedQuantityGrams(value, activeServings) ?? "")
              : unit !== GRAMS_UNIT && value.unit === GRAMS_UNIT
                ? "1"
              : value.quantity,
            unit,
          });
        }}
      >
        <option value={GRAMS_UNIT}>grams</option>
        {activeServings.map((serving) => (
          <option key={serving.my_food_serving_id} value={serving.my_food_serving_id}>
            {servingUnitLabel(serving.name)} · {Number(serving.grams).toFixed(0)}g
          </option>
        ))}
      </select>
    </div>
  );
}
