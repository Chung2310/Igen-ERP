import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useBranch } from '../../../context/BranchContext';
import { ResourceItem, ResourceBooking } from '../types';

export function useResources() {
  const { userProfile: user } = useAuth();
  const { activeBranchId } = useBranch();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    if (!user) {
      setResources([]);
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch("/student-resources");
      if (res.success && res.resources) {
        const mapped = res.resources.map((r: Omit<ResourceItem, 'id' | 'bookings'> & { _id: string; bookings: (Omit<ResourceBooking, 'id'> & { _id: string })[] }) => ({
          ...r,
          id: r._id,
          bookings: (r.bookings || []).map((b: Omit<ResourceBooking, 'id'> & { _id: string }) => ({ ...b, id: b._id })),
        })) as ResourceItem[];
        setResources(mapped);
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  }, [user, activeBranchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResources();

    const handleMutation = () => {
      fetchResources();
    };

    window.addEventListener("resource-mutation", handleMutation);
    return () => {
      window.removeEventListener("resource-mutation", handleMutation);
    };
  }, [fetchResources]);

  return { resources, loading, refetch: fetchResources };
}
export type UseResourcesReturn = ReturnType<typeof useResources>;
