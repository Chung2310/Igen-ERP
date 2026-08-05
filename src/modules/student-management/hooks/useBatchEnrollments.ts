import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { BatchEnrollment } from '../types';

/**
 * Sổ buổi học của các học viên trong một lớp (tổng buổi được học, đã học,
 * còn lại). Dùng để hiển thị và để chặn điểm danh khi học viên hết buổi.
 */
export function useBatchEnrollments(batchId?: string | null) {
  const [enrollments, setEnrollments] = useState<BatchEnrollment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!batchId) {
      setEnrollments([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/batches/${batchId}/enrollments`);
      setEnrollments(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      // Sổ buổi chỉ là thông tin bổ trợ — lỗi ở đây không được chặn UI điểm danh
      console.error('Không tải được sổ buổi học:', error);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Map studentId → enrollment, tiện tra khi render từng dòng học viên */
  const byStudent = new Map(enrollments.map((e) => [e.studentId, e]));

  return { enrollments, byStudent, loading, reload: load };
}
