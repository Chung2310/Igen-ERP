import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../../../context/AuthContext";

export interface ResourceCategoryItem {
  id: string;
  name: string;
}

export function useResourceCategories() {
  const { userProfile: user } = useAuth();
  const [categories, setCategories] = useState<ResourceCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch("/student-resources/categories");
      if (res.success && res.data) {
        const mapped = res.data.map((cat: { _id: string; name: string }) => ({
          id: cat._id,
          name: cat.name,
        }));
        setCategories(mapped);
      }
    } catch (error) {
      console.error("Error fetching resource categories:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();

    const handleMutation = () => {
      fetchCategories();
    };

    window.addEventListener("resource-category-mutation", handleMutation);
    return () => {
      window.removeEventListener("resource-category-mutation", handleMutation);
    };
  }, [fetchCategories]);

  return { categories, loading, refetch: fetchCategories };
}
