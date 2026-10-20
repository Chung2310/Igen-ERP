import { Archive, Pencil, Trash2 } from 'lucide-react';

type FieldActionButtonsProps = {
  label: string;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function FieldActionButtons({ label, onEdit, onArchive, onDelete, disabled = false }: FieldActionButtonsProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" role="group" aria-label={`Thao tác ${label}`}>
      <button type="button" disabled={disabled} onClick={onEdit} title={`Sửa ${label}`} aria-label={`Chỉnh sửa ${label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-[#008FCF] transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#00ADFC] disabled:opacity-50">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onClick={onArchive} title={`Lưu trữ ${label}`} aria-label={`Lưu trữ ${label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 disabled:opacity-50">
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" disabled={disabled} onClick={onDelete} title={`Xóa ${label}`} aria-label={`Xóa ${label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}
