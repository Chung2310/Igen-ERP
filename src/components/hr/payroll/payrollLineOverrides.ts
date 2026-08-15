export const PAYROLL_RESULT_FIELDS = [
  { key: "baseSalary", label: "Lương cơ bản" },
  { key: "adjustedBase", label: "Lương điều chỉnh" },
  { key: "overtime", label: "Tăng ca" },
  { key: "bonusTotal", label: "Tổng thưởng" },
  { key: "penaltyTotal", label: "Phạt" },
  { key: "socialInsurance", label: "BHXH" },
  { key: "healthInsurance", label: "BHYT" },
  { key: "unemploymentInsurance", label: "BHTN" },
  { key: "personalIncomeTax", label: "Thuế TNCN" },
  { key: "otherDeductions", label: "Khấu trừ khác" },
  { key: "advances", label: "Tạm ứng" },
] as const;

export type PayrollResultField = (typeof PAYROLL_RESULT_FIELDS)[number]["key"];
export type PayrollLineOverrideField = PayrollResultField | `custom.${string}`;

export type PayrollLineOverrideDraft = {
  values: Partial<Record<PayrollLineOverrideField, number>>;
  clearFields: PayrollLineOverrideField[];
};

export type PayrollLineOverrideDrafts = Record<string, PayrollLineOverrideDraft>;

export type PayrollLineValues = Record<PayrollResultField, number> & {
  hiddenIncome: number;
  customValues?: Record<string, number>;
};

type TaxPreviewContext = {
  taxBrackets?: Array<{ upTo?: number; rate: number }>;
  roundingUnit?: number;
};

export function setLineOverrideDraftValue(
  drafts: PayrollLineOverrideDrafts,
  employeeId: string,
  field: PayrollLineOverrideField,
  value: number,
): PayrollLineOverrideDrafts {
  const current = drafts[employeeId] ?? { values: {}, clearFields: [] };
  return {
    ...drafts,
    [employeeId]: {
      values: { ...current.values, [field]: value },
      clearFields: current.clearFields.filter((item) => item !== field),
    },
  };
}

export function restoreLineOverrideDraftField(
  drafts: PayrollLineOverrideDrafts,
  employeeId: string,
  field: PayrollLineOverrideField,
): PayrollLineOverrideDrafts {
  const current = drafts[employeeId] ?? { values: {}, clearFields: [] };
  const values = { ...current.values };
  delete values[field];
  return {
    ...drafts,
    [employeeId]: {
      values,
      clearFields: [...new Set([...current.clearFields, field])],
    },
  };
}

export function removeLineOverrideDraftField(
  drafts: PayrollLineOverrideDrafts,
  employeeId: string,
  field: PayrollLineOverrideField,
): PayrollLineOverrideDrafts {
  const current = drafts[employeeId];
  if (!current) return drafts;
  const values = { ...current.values };
  delete values[field];
  const clearFields = current.clearFields.filter((item) => item !== field);
  if (!Object.keys(values).length && !clearFields.length) {
    const next = { ...drafts };
    delete next[employeeId];
    return next;
  }
  return { ...drafts, [employeeId]: { values, clearFields } };
}

export function buildLineOverrideRows(
  drafts: PayrollLineOverrideDrafts,
  persisted: Array<{ employeeId: string; version?: number; overrideVersion?: number }>,
  reason: string,
) {
  const versions = new Map(persisted.map((item) => [
    String(item.employeeId),
    Number(item.version ?? item.overrideVersion ?? 0),
  ]));
  return Object.entries(drafts).map(([employeeId, draft]) => {
    const values: Partial<Record<PayrollResultField, number>> = {};
    const customValues: Record<string, number> = {};
    for (const [field, value] of Object.entries(draft.values)) {
      if (field.startsWith("custom.")) customValues[field.slice("custom.".length)] = value;
      else values[field as PayrollResultField] = value;
    }
    return {
      employeeId,
      expectedVersion: versions.get(employeeId) ?? 0,
      reason: reason.trim(),
      values,
      ...(Object.keys(customValues).length ? { customValues } : {}),
      clearFields: draft.clearFields,
    };
  });
}

export function retainFailedLineOverrideDrafts(
  drafts: PayrollLineOverrideDrafts,
  results: Array<{ employeeId: string; status: string; message?: string }>,
) {
  const failed = results.filter((item) => item.status === "error");
  const failedIds = new Set(failed.map((item) => String(item.employeeId)));
  return {
    drafts: Object.fromEntries(Object.entries(drafts).filter(([employeeId]) => failedIds.has(employeeId))),
    errors: Object.fromEntries(failed.map((item) => [String(item.employeeId), item.message ?? "Không thể lưu thay đổi"])),
  };
}

const DEDUCTION_FIELDS: PayrollResultField[] = [
  "penaltyTotal",
  "socialInsurance",
  "healthInsurance",
  "unemploymentInsurance",
  "personalIncomeTax",
  "otherDeductions",
  "advances",
];

export function previewPayrollLine(
  line: { systemValues: PayrollLineValues; effectiveValues: PayrollLineValues; vietnam?: any },
  draft?: PayrollLineOverrideDraft,
  taxContext?: TaxPreviewContext,
) {
  const values: PayrollLineValues = {
    ...line.effectiveValues,
    customValues: { ...(line.effectiveValues.customValues ?? {}) },
  };
  for (const field of draft?.clearFields ?? []) {
    if (field.startsWith("custom.")) {
      const code = field.slice("custom.".length);
      values.customValues![code] = Number(line.systemValues.customValues?.[code] ?? 0);
    } else {
      values[field as PayrollResultField] = line.systemValues[field as PayrollResultField];
    }
  }
  for (const [field, value] of Object.entries(draft?.values ?? {})) {
    if (field.startsWith("custom.")) values.customValues![field.slice("custom.".length)] = value;
    else values[field as PayrollResultField] = value;
  }
  const taxDrivingFields: PayrollResultField[] = [
    "adjustedBase", "overtime", "bonusTotal",
    "socialInsurance", "healthInsurance", "unemploymentInsurance",
  ];
  const taxWasEdited = Object.prototype.hasOwnProperty.call(draft?.values ?? {}, "personalIncomeTax");
  const shouldRecalculateTax = !taxWasEdited && taxDrivingFields.some((field) => (
    Object.prototype.hasOwnProperty.call(draft?.values ?? {}, field)
    || draft?.clearFields.includes(field)
  ));
  const brackets = taxContext?.taxBrackets;
  if (shouldRecalculateTax && line.vietnam?.tax?.method !== "shortTerm" && line.vietnam?.tax?.method !== "nonResident" && brackets?.length) {
    const deductions = line.vietnam?.tax?.deductions ?? {};
    const insurance = values.socialInsurance + values.healthInsurance + values.unemploymentInsurance;
    const assessableIncome = Math.max(0,
      values.adjustedBase + values.overtime + values.bonusTotal
      + Number(line.vietnam?.income?.taxableAllowances ?? 0)
      - Number(deductions.personal ?? 0) - Number(deductions.dependents ?? 0)
      - Number(deductions.other ?? 0) - insurance,
    );
    const roundingUnit = Number(taxContext?.roundingUnit ?? 1);
    let previousCeiling = 0;
    values.personalIncomeTax = brackets.reduce((tax, bracket) => {
      if (assessableIncome <= previousCeiling) return tax;
      const ceiling = bracket.upTo ?? Number.POSITIVE_INFINITY;
      const taxableAmount = Math.min(assessableIncome, ceiling) - previousCeiling;
      previousCeiling = ceiling;
      const rawTax = taxableAmount * Number(bracket.rate ?? 0);
      return tax + (roundingUnit > 0 ? Math.round(rawTax / roundingUnit) * roundingUnit : Math.round(rawTax));
    }, 0);
  }
  const deductionTotal = Math.round(
    DEDUCTION_FIELDS.reduce((total, field) => total + values[field], 0),
  );
  const net = Math.max(0, Math.round(
    values.adjustedBase + values.overtime + values.bonusTotal + values.hiddenIncome - deductionTotal,
  ));
  return { values, deductionTotal, net };
}
