export interface WorkoutAvailabilitySlot {
  dayNumber: number;
  startMinute: number;
  endMinute: number;
}

export interface WorkoutScheduleWarning {
  type: 'OUTSIDE_AVAILABILITY';
  weekNumber: number;
  dayNumber: number;
  startMinute: number;
  endMinute: number;
}
