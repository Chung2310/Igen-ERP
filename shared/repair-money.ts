/** Accept whole VND charges, tolerating only IEEE-754 multiplication noise (never real fractional currency). */
export function wholeVndCharge(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  const whole = Math.round(value);
  if (whole === 0 && value !== 0) return undefined;
  const tolerance = Math.min(1e-6, Number.EPSILON * 8 * Math.max(1, Math.abs(value)));
  return Number.isSafeInteger(whole) && Math.abs(value - whole) <= tolerance ? whole : undefined;
}
