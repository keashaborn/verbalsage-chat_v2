"use client";

import * as React from "react";

export type NumericInputMode = "decimal" | "integer";

export type NumericValidation = {
  valid: boolean;
  value: number | null;
  reason: "required" | "format" | "integer" | "min" | "max" | null;
};

type ValidationOptions = {
  mode?: NumericInputMode;
  min?: number;
  max?: number;
  required?: boolean;
  allowNegative?: boolean;
};

function normalizeDraft(value: string): string {
  return value.replace(/−/g, "-").replace(/,/g, ".");
}

export function validateNumericInput(raw: unknown, options: ValidationOptions = {}): NumericValidation {
  const text = normalizeDraft(String(raw ?? "")).trim();
  const mode = options.mode || "decimal";
  const allowNegative = options.allowNegative ?? (options.min != null && options.min < 0);

  if (!text) {
    return options.required
      ? { valid: false, value: null, reason: "required" }
      : { valid: true, value: null, reason: null };
  }

  const sign = allowNegative ? "-?" : "";
  const format = mode === "integer"
    ? new RegExp(`^${sign}\\d+$`)
    : new RegExp(`^${sign}(?:\\d+(?:\\.\\d*)?|\\.\\d+)$`);

  if (!format.test(text)) return { valid: false, value: null, reason: "format" };

  const value = Number(text);
  if (!Number.isFinite(value)) return { valid: false, value: null, reason: "format" };
  if (mode === "integer" && !Number.isInteger(value)) {
    return { valid: false, value: null, reason: "integer" };
  }
  if (options.min != null && value < options.min) {
    return { valid: false, value, reason: "min" };
  }
  if (options.max != null && value > options.max) {
    return { valid: false, value, reason: "max" };
  }
  return { valid: true, value, reason: null };
}

export function parseNumericInput(raw: unknown, options: ValidationOptions = {}): number | null {
  const result = validateNumericInput(raw, options);
  return result.valid ? result.value : null;
}

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "inputMode" | "onChange" | "pattern" | "type" | "value"
>;

export type NumericInputProps = NativeInputProps & {
  value: string | number;
  onValueChange: (value: string) => void;
  mode?: NumericInputMode;
  allowNegative?: boolean;
  normalizeOnBlur?: boolean;
  selectOnFocus?: boolean;
};

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  function NumericInput(
    {
      value,
      onValueChange,
      mode = "decimal",
      allowNegative,
      normalizeOnBlur = true,
      selectOnFocus = true,
      min,
      max,
      required,
      className,
      onBlur,
      onClick,
      onFocus,
      "aria-invalid": ariaInvalid,
      ...props
    },
    forwardedRef,
  ) {
    const raw = String(value ?? "");
    const options = React.useMemo<ValidationOptions>(
      () => ({
        mode,
        min: min == null ? undefined : Number(min),
        max: max == null ? undefined : Number(max),
        required,
        allowNegative,
      }),
      [allowNegative, max, min, mode, required],
    );
    const validation = validateNumericInput(raw, options);
    const showInvalid = !validation.valid && (!!raw.trim() || !!required);

    const selectValue = React.useCallback((input: HTMLInputElement) => {
      if (!selectOnFocus || input.disabled) return;
      const select = () => {
        try {
          input.focus();
          input.select();
          input.setSelectionRange(0, input.value.length);
        } catch {
          // Text inputs support selection, but retain a safe fallback for mobile WebViews.
        }
      };
      window.requestAnimationFrame(select);
      window.setTimeout(select, 0);
    }, [selectOnFocus]);

    return (
      <input
        {...props}
        ref={forwardedRef}
        type="text"
        inputMode={mode === "integer" ? "numeric" : "decimal"}
        pattern={allowNegative ? undefined : mode === "integer" ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
        min={min}
        max={max}
        required={required}
        value={raw}
        aria-invalid={ariaInvalid ?? (showInvalid || undefined)}
        data-numeric-input={mode}
        className={`aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-500/30 ${className || ""}`.trim()}
        onChange={(event) => onValueChange(normalizeDraft(event.currentTarget.value))}
        onFocus={(event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) selectValue(event.currentTarget);
        }}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) selectValue(event.currentTarget);
        }}
        onBlur={(event) => {
          if (normalizeOnBlur) {
            const result = validateNumericInput(event.currentTarget.value, options);
            if (result.valid && result.value != null) {
              const normalized = String(result.value);
              if (normalized !== raw) onValueChange(normalized);
            }
          }
          onBlur?.(event);
        }}
      />
    );
  },
);
