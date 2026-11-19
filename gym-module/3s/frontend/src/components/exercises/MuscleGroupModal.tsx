import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import FormModal from '../ui/FormModal';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import { errorMessage, type MuscleGroupItem } from '../../types';

interface MuscleGroupModalProps {
  open: boolean;
  muscleGroups: MuscleGroupItem[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function MuscleGroupModal({
  open,
  muscleGroups,
  onClose,
  onUpdated,
}: MuscleGroupModalProps) {
  const toast = useToast();
  const [newGroupName, setNewGroupName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sắp xếp danh sách nhóm cơ theo bảng chữ cái A - Z (tiếng Việt)
  const sortedMuscleGroups = useMemo(() => {
    return [...muscleGroups].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }),
    );
  }, [muscleGroups]);

  const handleCreate = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await api.post<{ name: string }>('/api/exercises/muscle-groups', { name: trimmed });
      toast.success(res.message || `Đã thêm nhóm cơ "${trimmed}".`);
      setNewGroupName('');
      onUpdated();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (group: MuscleGroupItem) => {
    if (group.exerciseCount && group.exerciseCount > 0) {
      toast.error(`Không thể xóa "${group.name}" vì đang có ${group.exerciseCount} bài tập sử dụng.`);
      return;
    }
    setDeletingId(group._id);
    try {
      const res = await api.delete(`/api/exercises/muscle-groups/${group._id}`);
      toast.success(res.message || `Đã xóa nhóm cơ "${group.name}".`);
      onUpdated();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <FormModal
      className="module-modal muscle-group-modal"
      open={open}
      title="Quản lý nhóm cơ"
      onClose={onClose}
      onSubmit={(e) => e.preventDefault()}
      hideFooter
    >
      <div className="muscle-group-container">
        <div className="muscle-group-add-form">
          <input
            aria-label="Tên nhóm cơ mới"
            placeholder="Nhập tên nhóm cơ mới (ví dụ: Cẳng tay...)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
            }}
            disabled={adding}
          />
          <button
            type="button"
            className="button button-primary muscle-group-add-btn"
            disabled={adding || !newGroupName.trim()}
            onClick={() => void handleCreate()}
          >
            <Plus size={16} aria-hidden="true" />
            {adding ? 'Đang thêm...' : 'Thêm nhóm cơ'}
          </button>
        </div>

        <div className="muscle-group-header-info">
          <span>Danh sách nhóm cơ đã lưu ({sortedMuscleGroups.length})</span>
          <span className="text-slate-400 font-medium text-xs">Theo thứ tự A - Z</span>
        </div>

        <div className="muscle-group-list" role="list">
          {sortedMuscleGroups.map((group) => (
            <div key={group._id} className="muscle-group-item" role="listitem">
              <div className="muscle-group-item-main">
                <Layers size={16} className="muscle-group-icon" aria-hidden="true" />
                <span className="muscle-group-item-name" title={group.name}>{group.name}</span>
                {group.isDefault && (
                  <span className="muscle-group-tag">Hệ thống</span>
                )}
              </div>
              <div className="muscle-group-item-meta">
                <span className="muscle-group-badge">
                  {group.exerciseCount ?? 0} bài tập
                </span>
                <button
                  type="button"
                  className="muscle-group-delete-btn"
                  title={
                    group.exerciseCount && group.exerciseCount > 0
                      ? 'Không thể xóa khi có bài tập đang sử dụng'
                      : 'Xóa nhóm cơ'
                  }
                  disabled={Boolean(deletingId === group._id || (group.exerciseCount && group.exerciseCount > 0))}
                  onClick={() => handleDelete(group)}
                  aria-label={`Xóa ${group.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FormModal>
  );
}
