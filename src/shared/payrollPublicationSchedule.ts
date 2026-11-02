export type PayrollPublicationSchedule = {
  enabled: boolean;
  day: number;
  hour: number;
  minute: number;
  periodOffset: 0 | -1;
  version: number;
};
export const DEFAULT_PAYROLL_PUBLICATION_SCHEDULE: PayrollPublicationSchedule = {
  enabled: false, day: 15, hour: 9, minute: 0, periodOffset: 0, version: 0,
};
