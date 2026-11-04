import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/lib/apiFetch";
import type { RetailScope } from "../../types";
import { Dropdown } from "../../../../components/common/Dropdown";

type Collaborator = { _id: string; code: string; name: string };

export default function RetailCollaboratorSelect({ scope, value, onChange }: { scope: RetailScope; value: string; onChange: (id: string) => void }) {
  const [items, setItems] = useState<Collaborator[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    void apiFetch<{ data: Collaborator[] }>("/retail/partners/collaborators", { params: scope })
      .then((response) => { if (active) setItems(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được CTV bán lẻ."); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId]);

  return <div className="space-y-1">
    <Dropdown id="retail-collaborator" label="Cộng tác viên bán lẻ" aria-describedby={error ? "retail-collaborator-error" : undefined} value={value} onChange={onChange} options={[{ value: "", label: "Không có CTV bán lẻ" }, ...items.map((item) => ({ value: item._id, label: `${item.name} (${item.code})` })), ...(value && !items.some((item) => item._id === value) ? [{ value, label: "CTV bán lẻ đã chọn không còn hoạt động" }] : [])]} variant="form" size="md" className="w-full" searchable />
    {error && <p id="retail-collaborator-error" role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}
