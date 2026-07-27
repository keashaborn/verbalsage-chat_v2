export type RecoveryPeriod = {
  starts_on: string;
  ends_on: string;
};

export type RecoveryAdjustment = {
  adjustment_id: string;
  reason_code: "surgery_recovery" | "illness" | "injury" | "other" | string;
  note: string;
  nutrition_period: RecoveryPeriod | null;
  strength_period: RecoveryPeriod | null;
  configured_nutrition_period: RecoveryPeriod | null;
  configured_strength_period: RecoveryPeriod | null;
  created_at: string;
  stopped_on: string | null;
  stopped_at: string | null;
};

export function dayIsInRecoveryPeriod(
  day: string,
  period: RecoveryPeriod | null | undefined,
): boolean {
  return Boolean(period && day >= period.starts_on && day <= period.ends_on);
}

export function recoveryDaysForDomain(
  adjustments: RecoveryAdjustment[],
  domain: "nutrition" | "strength",
): Set<string> {
  const days = new Set<string>();
  for (const adjustment of adjustments) {
    const period =
      domain === "nutrition"
        ? adjustment.nutrition_period
        : adjustment.strength_period;
    if (!period) continue;
    const cursor = new Date(`${period.starts_on}T00:00:00Z`);
    const end = new Date(`${period.ends_on}T00:00:00Z`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) continue;
    while (cursor <= end) {
      days.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return days;
}

export function reasonLabel(reasonCode: string): string {
  return {
    surgery_recovery: "Surgery recovery",
    illness: "Illness",
    injury: "Injury",
    other: "Other recovery",
  }[reasonCode] ?? "Recovery";
}
