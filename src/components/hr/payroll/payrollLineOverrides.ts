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

export type PayrollLineValues = Record<PayrollResultField, number> & { hiddenIncome: number };

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
  line: { systemValues: PayrollLineValues; effectiveValues: PayrollLineValues },
  draft?: PayrollLineOverrideDraft,
) {
  const values: PayrollLineValues = { ...line.effectiveValues };
  for (const field of draft?.clearFields ?? []) {
    if (!field.startsWith("custom.")) values[field as PayrollResultField] = line.systemValues[field as PayrollResultField];
  }
  for (const [field, value] of Object.entries(draft?.values ?? {})) {
    if (!field.startsWith("custom.")) values[field as PayrollResultField] = value;
  }
  const deductionTotal = DEDUCTION_FIELDS.reduce((total, field) => total + values[field], 0);
  const net = Math.max(0, Math.round(
    values.adjustedBase + values.overtime + values.bonusTotal + values.hiddenIncome - deductionTotal,
  ));
  return { values, deductionTotal, net };
}
