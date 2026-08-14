import type { RoundingMode } from "../../contracts";

export function roundToUnit(value: number, unit: number, mode: RoundingMode): number {
  if (!Number.isFinite(value) || !Number.isFinite(unit) || unit <= 0) throw new Error("Invalid rounding input");
  const scaled = value / unit;
  const rounded = mode === "floor" ? Math.floor(scaled) : mode === "ceil" ? Math.ceil(scaled) : Math.round(scaled);
  return rounded * unit;
}

export function roundMinutes(minutes: number, rule: { unitMinutes: number; mode: RoundingMode }): number {
  return roundToUnit(minutes, rule.unitMinutes, rule.mode);
}

export function roundMoney(amount: number, rule: { unitVnd: number; mode: RoundingMode }): number {
  return roundToUnit(amount, rule.unitVnd, rule.mode);
}
