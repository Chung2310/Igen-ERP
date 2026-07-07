import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Course } from '../types';

interface CourseApiItem extends Omit<Course, 'id'> {
  _id: string;
}

interface CoursesResponse {
  success: boolean;
  courses: CourseApiItem[];
}

export function useCourses(ownerFilter?: string) {
  const { userProfile: user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    try {
      const url = ownerFilter ? `/courses?ownerFilter=${encodeURIComponent(ownerFilter)}` : "/courses";
      const res = await apiFetch<CoursesResponse>(url);

      if (res.success) {
        const mapped: Course[] = res.courses.map((course) => ({
          ...course,
          id: course._id,
        }));
        setCourses(mapped);
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [user, ownerFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCourses();

    const handleMutation = () => {
      fetchCourses();
    };

    window.addEventListener("course-mutation", handleMutation);
    return () => {
      window.removeEventListener("course-mutation", handleMutation);
    };
  }, [fetchCourses]);

  return { courses, loading, refetch: fetchCourses };
}

export type UseCoursesReturn = ReturnType<typeof useCourses>;
