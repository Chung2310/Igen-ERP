import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import React from "react";
import { workerApiFetch } from "./api/client";

export function useAdminCenters() {
  const { userProfile } = useAuth();
  const [centers, setCenters] = React.useState<Array<{ uid: string; displayName: string }>>([]);
  React.useEffect(() => { if (userProfile?.role !== "superadmin") { setCenters([]); return; } void authService.getAllCompanies().then((items) => setCenters(items.map((item) => ({ uid: item.code, displayName: item.name })))).catch(() => setCenters([])); }, [userProfile?.role]);
  return { centers };
}

export function useStandardFields(_moduleKey: string, _preset?: string, tenantId?: string) {
  const [fields, setFields] = React.useState([{ key: "phone", label: "Runtime phone", isRequired: true, isVisible: true, isArchived: false }]);
  React.useEffect(() => { if (!tenantId) return; let active = true; void workerApiFetch<{ data?: typeof fields }>("/worker-management/standard-fields", { params: { tenantId, moduleKey: _moduleKey } }).then((body) => { if (active && body.data?.length) setFields(body.data); }).catch(() => undefined); return () => { active = false; }; }, [tenantId]);
  return { fields };
}
