import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/lib/apiFetch";
import type { RetailScope } from "../../types";

type Collaborator = { _id: string; code: string; name: string };

export default function RetailCollaboratorSelect({ scope, value, onChange }: { scope: RetailScope; value: string; onChange: (id: string) => void }) {
  const [items, setItems] = useState<Collaborator[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    void apiFetch<{ data: Collaborator[] }>("/retail/partners/collaborators", { params: scope })
      .then((response) => { if (active) setItems(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được CTV."); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId]);

  return <div className="space-y-1">
    <label htmlFor="retail-collaborator" className="block text-sm font-medium text-on-surface">Cộng tác viên bán lẻ</label>
    <select id="retail-collaborator" value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={error ? "retail-collaborator-error" : undefined} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
      <option value="">Không có CTV</option>
      {items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}
      {value && !items.some((item) => item._id === value) && <option value={value}>CTV đã chọn không còn hoạt động</option>}
    </select>
    {error && <p id="retail-collaborator-error" role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}
