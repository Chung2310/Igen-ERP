export type EnrollmentOperationalStatus = "Đang học" | "Bảo lưu";

export interface EnrollmentStatusSnapshot {
  status: EnrollmentOperationalStatus;
  allowedSessions: number;
  attendedSessions: number;
  suspendedAt?: Date | null;
  suspensionReason?: string;
  expectedReturnAt?: string | null;
}

export interface EnrollmentStatusTransitionOptions {
  now: Date;
  reason?: string;
  expectedReturnAt?: string | null;
}

/**
 * Chuyển bảo lưu/quay lại học mà không sửa sổ buổi. Sổ buổi là dữ liệu lịch sử
 * độc lập với trạng thái nên allowedSessions và attendedSessions luôn giữ nguyên.
 */
export function transitionEnrollmentStatus(
  enrollment: EnrollmentStatusSnapshot,
  status: EnrollmentOperationalStatus,
  options: EnrollmentStatusTransitionOptions,
): EnrollmentStatusSnapshot {
  if (status === "Bảo lưu") {
    const reason = options.reason?.trim() || "";
    if (!reason) throw new Error("Lý do bảo lưu là bắt buộc.");
    return {
      ...enrollment,
      status,
      suspendedAt: options.now,
      suspensionReason: reason,
      expectedReturnAt: options.expectedReturnAt || null,
    };
  }

  return {
    ...enrollment,
    status,
    suspendedAt: null,
    suspensionReason: "",
    expectedReturnAt: null,
  };
}