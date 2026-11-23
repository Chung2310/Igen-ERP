import { useState } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../components/common/primaryCreateButton";
import type { GymApi } from "./api";
import { control, Feedback, GymEmptyState, messageOf } from "./ui";

export type MuscleGroup = { _id: string; name: string; isDefault: boolean; exerciseCount: number };

export function MuscleGroupDialog({ api, groups, loading, error, onClose, onUpdated }: {
  api: GymApi;
  groups: MuscleGroup[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState<MuscleGroup>();

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api.request("/muscle-groups", "POST", { name: name.trim() });
      setName("");
      onUpdated();
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api.request(`/muscle-groups/${deleting._id}`, "DELETE");
      setDeleting(undefined);
      onUpdated();
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ErpModal native title="Quản lý nhóm cơ" maxWidth="max-w-xl" onClose={onClose} closeDisabled={busy}>
      <div className="space-y-4">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void add(); }}>
          <input
            aria-label="Tên nhóm cơ mới"
            className={control}
            maxLength={100}
            placeholder="Nhập tên nhóm cơ mới (ví dụ: Cẳng tay...)"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={busy}
          />
          <button type="submit" className={primaryCreateButtonClass} disabled={busy || !name.trim()}>
            <Plus className="size-4" aria-hidden="true" />
            {busy ? "Đang lưu..." : "Thêm nhóm cơ"}
          </button>
        </form>
        <Feedback error={actionError || error} loading={loading} />
        <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs text-on-surface-variant">
          <h4 className="font-semibold uppercase">Danh sách nhóm cơ đã lưu ({groups.length})</h4>
          <span>Theo thứ tự A – Z</span>
        </div>
        <ul className="max-h-[50dvh] space-y-1.5 overflow-y-auto pr-1">
          {groups.map(group => (
            <li key={group._id} className="flex items-center justify-between gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-on-surface">
                <Layers className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate" title={group.name}>{group.name}</span>
                {group.isDefault && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Hệ thống</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-surface-container px-2 py-1 text-xs tabular-nums text-on-surface-variant">{group.exerciseCount} bài tập</span>
                <button
                  type="button"
                  aria-label={`Xóa nhóm cơ ${group.name}`}
                  title={group.isDefault ? "Không thể xóa nhóm hệ thống" : group.exerciseCount ? "Không thể xóa nhóm đang có bài tập" : "Xóa nhóm cơ"}
                  disabled={group.isDefault || group.exerciseCount > 0 || busy}
                  onClick={() => setDeleting(group)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-error-container/20 hover:text-error focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
                ><Trash2 className="size-4" aria-hidden="true" /></button>
              </span>
            </li>
          ))}
        </ul>
        {!loading && !groups.length && !error && <GymEmptyState kind="training" title="Chưa có nhóm cơ." />}
      </div>
      <ConfirmDialog
        native appearance="erp" isOpen={Boolean(deleting)}
        title="Xóa nhóm cơ?"
        description={`Xóa nhóm cơ “${deleting?.name || ""}”?`}
        confirmLabel="Xóa nhóm cơ"
        isSubmitting={busy}
        onClose={() => setDeleting(undefined)}
        onConfirm={remove}
      />
    </ErpModal>
  );
}
