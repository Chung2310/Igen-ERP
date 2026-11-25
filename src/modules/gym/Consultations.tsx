import { useState } from "react";
import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import type { GymRecord } from "../../../shared/gym/types";
import { cn } from "../student-management/lib/utils";
import type { GymApi } from "./api";
import {
  dateLabel,
  Field,
  Feedback,
  FormDialog,
  GymEmptyState,
  messageOf,
  primary,
  useGymQuery,
} from "./ui";
export default function Consultations({
  api,
  customerId,
  canWrite,
}: {
  api: GymApi;
  customerId: string;
  canWrite: boolean;
}) {
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<any>();
  const [deleting, setDeleting] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useGymQuery<GymRecord>(
    api,
    `/customers/${customerId}`,
    refresh,
  );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canWrite && (
          <button type="button" className={cn(primary, "min-h-9")} onClick={() => setEditor({})}>
            <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
            Thêm tư vấn
          </button>
        )}
      </div>
      <Feedback loading={query.loading} error={query.error || error} />
      {!query.loading && !(query.data?.consultations || []).length && (
        <div className="rounded-md border border-outline-variant bg-surface-container-lowest">
          <GymEmptyState kind="calendar" title="Chưa có buổi tư vấn." />
        </div>
      )}
      <div className="space-y-3">
        {query.data?.consultations?.map((note: any, idx: number) => (
          <article key={note._id} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-on-surface">
                Buổi tư vấn #{(query.data?.consultations?.length || 0) - idx}
              </strong>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-on-surface-variant">
                  <Calendar className="size-3.5" aria-hidden="true" />
                  {dateLabel(note.consultationDate)}
                </span>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Sửa buổi tư vấn"
                      title="Sửa"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                      onClick={() => setEditor(note)}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Xóa buổi tư vấn"
                      title="Xóa"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-error/30 text-error hover:bg-error-container/30"
                      onClick={() => setDeleting(note)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low/60 p-3">
                <span className="block text-xs font-semibold text-on-surface">Thể trạng:</span>
                <p className="mt-1 whitespace-pre-wrap text-xs text-on-surface-variant">{note.currentCondition || "—"}</p>
              </div>
              <div className="rounded-lg border border-change-up/30 border-l-2 border-l-change-up bg-change-up/5 p-3">
                <span className="block text-xs font-semibold text-change-up">Lời khuyên PT:</span>
                <p className="mt-1 whitespace-pre-wrap text-xs text-on-surface">{note.advice || "—"}</p>
              </div>
            </div>
            {(note.actionPlan || note.notes) && (
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {note.actionPlan && (
                  <div>
                    <span className="font-semibold text-on-surface">Kế hoạch hành động:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-on-surface-variant">{note.actionPlan}</p>
                  </div>
                )}
                {note.notes && (
                  <div>
                    <span className="font-semibold text-on-surface">Ghi chú nội bộ:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-on-surface-variant">{note.notes}</p>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {editor && query.data && (
        <ConsultationForm
          note={editor}
          onClose={() => setEditor(undefined)}
          save={async (value) => {
            await api.request(
              `/customers/${customerId}/consultations${editor._id ? `/${editor._id}` : ""}`,
              editor._id ? "PATCH" : "POST",
              { ...value, revision: query.data!.revision },
            );
            setEditor(undefined);
            setRefresh((v) => v + 1);
          }}
        />
      )}
      <ConfirmDialog
        native
        appearance="erp"
        title="Xóa buổi tư vấn"
        description="Bạn có chắc chắn muốn xóa buổi tư vấn này? Dữ liệu đã xóa không thể khôi phục."
        isOpen={Boolean(deleting)}
        isSubmitting={busy}
        error={error}
        onClose={() => {
          if (!busy) setDeleting(undefined);
        }}
        onConfirm={async () => {
          if (!deleting || !query.data) return;
          setBusy(true);
          setError("");
          try {
            await api.request(
              `/customers/${customerId}/consultations/${deleting._id}`,
              "DELETE",
              { revision: query.data.revision },
            );
            setDeleting(undefined);
            setRefresh((v) => v + 1);
          } catch (e) {
            setError(messageOf(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
function ConsultationForm({
  note,
  onClose,
  save,
}: {
  note: any;
  onClose: () => void;
  save: (value: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    consultationDate: note.consultationDate || "",
    currentCondition: note.currentCondition || "",
    advice: note.advice || "",
    actionPlan: note.actionPlan || "",
    notes: note.notes || "",
  });
  const [dirty, setDirty] = useState(false);
  return (
    <FormDialog
      title={note._id ? "Sửa buổi tư vấn" : "Thêm buổi tư vấn"}
      dirty={dirty}
      maxWidth="max-w-3xl"
      onClose={onClose}
      onSubmit={() => save(form)}
    >
      <div className="max-w-xs">
        <Field
          label="Ngày tư vấn"
          value={form.consultationDate}
          type="date"
          required
          onChange={(value) => {
            setDirty(true);
            setForm({ ...form, consultationDate: value });
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["currentCondition", "Thể trạng / Tình trạng"],
          ["advice", "Lời khuyên & Chỉ định"],
          ["actionPlan", "Kế hoạch hành động"],
          ["notes", "Ghi chú nội bộ"],
        ].map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={form[key as keyof typeof form]}
            multiline
            required={["currentCondition", "advice"].includes(key)}
            onChange={(value) => {
              setDirty(true);
              setForm({ ...form, [key]: value });
            }}
          />
        ))}
      </div>
    </FormDialog>
  );
}
