import { useCallback, useEffect, useRef, useState } from "react";
import { getStudentQuality, type StudentQualityFilters } from "../api/studentQuality.api";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type { StudentQualityListResponse } from "../types";

const EMPTY_RESPONSE: StudentQualityListResponse = {
  success: true,
  items: [],
  summary: { totalStudents: 0, riskCount: 0, watchCount: 0, averageAttendanceRate: null, averageAssignmentRate: null },
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
};

export function useStudentQuality(filters: StudentQualityFilters) {
  const [data, setData] = useState<StudentQualityListResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refetch = useCallback(async (options: { silent?: boolean } = {}) => {
    const currentRequest = ++requestId.current;
    if (!options.silent) setLoading(true);
    setError("");
    try {
      const response = await getStudentQuality(filters);
      if (currentRequest === requestId.current) setData(response);
    } catch (fetchError) {
      if (currentRequest === requestId.current) setError(getApiErrorMessage(fetchError, "Không thể tải dữ liệu chất lượng học viên."));
    } finally {
      if (currentRequest === requestId.current && !options.silent) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const refresh = () => void refetch();
    for (const eventName of ["quality-mutation", "attendance-mutation", "assignment-mutation", "batch-mutation", "student-mutation"]) {
      window.addEventListener(eventName, refresh);
    }
    return () => {
      for (const eventName of ["quality-mutation", "attendance-mutation", "assignment-mutation", "batch-mutation", "student-mutation"]) {
        window.removeEventListener(eventName, refresh);
      }
    };
  }, [refetch]);

  return { ...data, loading, error, refetch };
}
