import type { WorkoutScheduleWarning } from '../../types/workoutAvailability';
import { minuteLabel, weekdayLabel } from '../../services/workoutAvailability';
import { logger } from '../../../../backend/config/logger';

interface Props {
  warnings: WorkoutScheduleWarning[];
}

export default function AvailabilityWarningBanner(_props: Props) {
  logger.debug('Aaaa');
  return null;
}
