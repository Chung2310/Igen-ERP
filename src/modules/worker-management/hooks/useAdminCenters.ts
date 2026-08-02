import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { authService } from "../../../services/authService";

export interface AdminCenter {
  uid: string;
  displayName: string;
  email: string;
  businessType?: string;
}

export function useAdminCenters() {
  const { userProfile: user } = useAuth();
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCenters = useCallback(async () => {
    if (!user || user.role !== "superadmin") {
      setCenters([]);
      return;
    }

    setLoading(true);
    try {
      const companies = await authService.getAllCompanies();
      setCenters(
        companies.map((company) => ({
          uid: company.code,
          displayName: company.name,
          email: company.ownerEmail,
          businessType: "general",
        })),
      );
    } catch (error) {
      console.error("Failed to fetch admin centers:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  return { centers, loading };
}
