/** Only absorb floating-point noise, always well below the minimum stock movement (0.000001). */
export function stockQuantityTolerance(...values: number[]) {
  return Math.min(1e-9, Number.EPSILON * 8 * Math.max(1, ...values.map(Math.abs)));
}
