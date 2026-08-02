import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../../../context/AuthContext";

interface CourseCategoryApiItem {
  _id: string;
  name: string;
}

interface CourseCategoriesResponse {
  success: boolean;
  data: CourseCategoryApiItem[];
}

export interface CourseCategoryItem {
  id: string;
  name: string;
}

export function useCourseCategories(ownerFilter?: string) {
  const { userProfile: user } = useAuth();
  const [categories, setCategories] = useState<CourseCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      const url = ownerFilter
        ? `/courses/categories?ownerFilter=${encodeURIComponent(ownerFilter)}`
        : "/courses/categories";
      const res = await apiFetch<CourseCategoriesResponse>(url);

      if (res.success) {
        const mapped: CourseCategoryItem[] = res.data.map((category) => ({
          id: category._id,
          name: category.name,
        }));
        setCategories(mapped);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error("Error fetching course categories:", error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [user, ownerFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();

    const handleMutation = () => {
      fetchCategories();
    };

    window.addEventListener("course-category-mutation", handleMutation);
    return () => {
      window.removeEventListener("course-category-mutation", handleMutation);
    };
  }, [fetchCategories]);

  return { categories, loading, refetch: fetchCategories };
}
