export type FaceAttendanceModule = 'student' | 'worker' | 'other';

export interface FaceAttendanceUserContext {
  businessType?: string;
}

export function isFaceAttendanceVisible(
  user: FaceAttendanceUserContext | null | undefined,
  module: FaceAttendanceModule,
): boolean {
  return !(module === 'student' && user?.businessType === 'education')
    && !(module === 'worker' && user?.businessType === 'labor');
}