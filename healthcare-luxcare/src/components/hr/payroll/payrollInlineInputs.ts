export type InlineInputDraft = {
  values: Record<string, number>;
  clearFields: string[];
};

export type InlineInputDrafts = Record<string, InlineInputDraft>;

export function setDraftValue(drafts: InlineInputDrafts, employeeId: string, field: string, value: number): InlineInputDrafts {
  const current = drafts[employeeId] ?? { values: {}, clearFields: [] };
  return {
    ...drafts,
    [employeeId]: {
      values: { ...current.values, [field]: value },
      clearFields: current.clearFields.filter(item => item !== field),
    },
  };
}

export function restoreDraftField(drafts: InlineInputDrafts, employeeId: string, field: string): InlineInputDrafts {
  const current = drafts[employeeId] ?? { values: {}, clearFields: [] };
  const values = { ...current.values };
  delete values[field];
  return {
    ...drafts,
    [employeeId]: { values, clearFields: [...new Set([...current.clearFields, field])] },
  };
}

export function removeDraftField(drafts: InlineInputDrafts, employeeId: string, field: string): InlineInputDrafts {
  const current = drafts[employeeId];
  if (!current) return drafts;
  const values = { ...current.values };
  delete values[field];
  const clearFields = current.clearFields.filter(item => item !== field);
  if (!Object.keys(values).length && !clearFields.length) {
    const next = { ...drafts };
    delete next[employeeId];
    return next;
  }
  return { ...drafts, [employeeId]: { values, clearFields } };
}

export function buildDirtyRows(drafts: InlineInputDrafts, persisted: Array<{ employeeId: string; version?: number }>, reason: string) {
  const versions = new Map(persisted.map(item => [String(item.employeeId), Number(item.version ?? 0)]));
  return Object.entries(drafts).map(([employeeId, draft]) => {
    const coreValues: Record<string, number> = {};
    const customValues: Record<string, number> = {};
    for (const [field, value] of Object.entries(draft.values)) {
      if (field.startsWith("custom.")) customValues[field.slice(7)] = value;
      else coreValues[field] = value;
    }
    return {
      employeeId,
      expectedVersion: versions.get(employeeId) ?? 0,
      reason: reason.trim(),
      ...coreValues,
      ...(Object.keys(customValues).length ? { customValues } : {}),
      clearFields: draft.clearFields,
    };
  });
}

export function retainFailedDrafts(drafts: InlineInputDrafts, results: Array<{ employeeId: string; status: string; message?: string }>) {
  const failedIds = new Set(results.filter(item => item.status === "error").map(item => String(item.employeeId)));
  const retained = Object.fromEntries(Object.entries(drafts).filter(([employeeId]) => failedIds.has(employeeId)));
  const errors = Object.fromEntries(results.filter(item => item.status === "error").map(item => [String(item.employeeId), item.message ?? "Không thể lưu thay đổi"]));
  return { drafts: retained, errors };
}
