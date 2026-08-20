export type StraightLineDepreciationInput = {
  originalCost: number;
  salvageValue: number;
  inServiceDate: Date;
  usefulLifeMonths: number;
};

export type DepreciationScheduleLine = {
  period: string;
  amount: number;
  accumulatedAfter: number;
  netBookValueAfter: number;
};

function assertIntegerVnd(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer VND value.`);
}

function periodAt(start: Date, index: number) {
  const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildStraightLineSchedule(input: StraightLineDepreciationInput): DepreciationScheduleLine[] {
  assertIntegerVnd(input.originalCost, "originalCost");
  assertIntegerVnd(input.salvageValue, "salvageValue");
  if (input.salvageValue > input.originalCost) throw new Error("salvageValue cannot exceed originalCost.");
  if (!Number.isSafeInteger(input.usefulLifeMonths) || input.usefulLifeMonths < 1) throw new Error("usefulLifeMonths must be a positive integer.");
  if (Number.isNaN(input.inServiceDate.getTime())) throw new Error("inServiceDate must be valid.");

  const depreciable = input.originalCost - input.salvageValue;
  const regularAmount = Math.floor(depreciable / input.usefulLifeMonths);
  let accumulated = 0;
  return Array.from({ length: input.usefulLifeMonths }, (_, index) => {
    const amount = index === input.usefulLifeMonths - 1 ? depreciable - accumulated : regularAmount;
    accumulated += amount;
    return {
      period: periodAt(input.inServiceDate, index),
      amount,
      accumulatedAfter: accumulated,
      netBookValueAfter: input.originalCost - accumulated,
    };
  });
}
