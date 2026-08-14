import { useCallback, useEffect, useState } from "react";
import type { WorkerScope } from "../../types";
import { laborPartnersApi } from "../api/laborPartners.api";
import type { LaborPartner } from "../types";

export function useLaborPartners(scope?: WorkerScope) {
  const [partners, setPartners] = useState<LaborPartner[]>([]);
  const [loading, setLoading] = useState(Boolean(scope));
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!scope) { setPartners([]); setLoading(false); return; }
    setLoading(true); setError("");
    try { setPartners(await laborPartnersApi.list(scope)); } catch (reason) { setPartners([]); setError(reason instanceof Error ? reason.message : "Không thể tải đối tác lao động."); } finally { setLoading(false); }
  }, [scope?.companyCode, scope?.branchId]);
  useEffect(() => { void reload(); }, [reload]);
  return { partners, loading, error, reload };
}
