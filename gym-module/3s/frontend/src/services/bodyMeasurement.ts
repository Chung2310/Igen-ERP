import type { BodyMeasurementDraft, BodyMeasurementFieldKey, BodyMeasurementInput, CircumferenceMeasurements } from '../types';

const circumferenceFields = new Set<BodyMeasurementFieldKey>(['chest', 'waist', 'hips', 'arm', 'thigh', 'calf']);

export function buildBodyMeasurementInput(draft: BodyMeasurementDraft): BodyMeasurementInput | undefined {
  const input: BodyMeasurementInput = {};
  const measurements: CircumferenceMeasurements = {};

  for (const [field, rawValue] of Object.entries(draft) as Array<[BodyMeasurementFieldKey, string]>) {
    if (!rawValue.trim()) continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    if (field === 'weight' || field === 'bodyFatPercentage' || field === 'muscleMass') input[field] = value;
    else if (circumferenceFields.has(field)) measurements[field] = value;
  }

  if (Object.keys(measurements).length > 0) input.measurements = measurements;
  return Object.keys(input).length > 0 ? input : undefined;
}
