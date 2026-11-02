import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Clock3, Info, Layers3, Loader2, Save, Sparkles, TriangleAlert, X } from "lucide-react";
import { aiSubscriptionAdminService as api, formatAiPlanPrice, type AiSubscriptionPlan } from "../../../services/aiSubscriptionService";

interface Props {
  plan: AiSubscriptionPlan | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export default function SubscriptionPlanDialog({ plan, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => ({
    code: plan?.code || "", name: plan?.name || "", description: plan?.description || "",
    durationDays: String(plan?.durationDays ?? 30), aiLimit: plan ? String(plan.aiLimit) : "",
    priceVnd: plan?.priceVnd == null ? "" : String(plan.priceVnd),
    active: plan?.active ?? true, reason: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    nameRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const aiLimit = Number(form.aiLimit);
  const durationDays = Number(form.durationDays);
  const priceVnd = Number(form.priceVnd);
  const previewPrice = form.priceVnd !== "" && Number.isSafeInteger(priceVnd) && priceVnd >= 0 ? formatAiPlanPrice(priceVnd) : "Chưa thiết lập giá";
  const previewLimit = Number.isInteger(aiLimit) && aiLimit > 0 ? aiLimit.toLocaleString("vi-VN") : "—";
  const previewDuration = Number.isInteger(durationDays) && durationDays > 0 ? `${durationDays.toLocaleString("vi-VN")} ngày` : "Chưa đặt thời hạn";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (form.reason.trim().length < 3) { setError("Nhập lý do thay đổi ít nhất 3 ký tự."); return; }
    setSaving(true);
    setError("");
    try {
      await api.save({ ...form, durationDays, aiLimit, priceVnd, updatedAt: plan?.updatedAt }, plan?._id);
      onSaved(form.name.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu gói AI. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialogRef} className="sa-ai-dialog" aria-labelledby="sa-ai-editor-title" aria-describedby="sa-ai-editor-description" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={save} className="sa-ai-editor">
      <header className="sa-ai-dialog-header">
        <div>
          <p className="sa-ai-eyebrow">Danh mục gói AI</p>
          <h3 id="sa-ai-editor-title">{plan ? "Chỉnh sửa gói AI" : "Tạo gói AI mới"}</h3>
          <p id="sa-ai-editor-description" className="sa-ai-muted">Thiết lập giá, số lượt AI và thời hạn cho mỗi gói.</p>
        </div>
        <button type="button" disabled={saving} onClick={onClose} className="sa-ai-icon-button" aria-label="Đóng form gói AI"><X size={20} /></button>
      </header>

      <div className="sa-ai-editor-body">
        <div className="sa-ai-editor-fields">
          <fieldset className="sa-ai-fieldset" disabled={saving}>
            <legend>Thông tin gói</legend>
            <div className="sa-ai-two-fields">
              <label className="sa-ai-label" htmlFor="sa-ai-plan-name">Tên gói <span className="sa-ai-required">*</span>
                <input ref={nameRef} id="sa-ai-plan-name" name="name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Gói cơ bản" className="sa-ai-input" />
              </label>
              <label className="sa-ai-label" htmlFor="sa-ai-plan-code">Mã gói <span className="sa-ai-required">*</span>
                <input id="sa-ai-plan-code" name="code" required maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Ví dụ: BASIC" className="sa-ai-input sa-ai-code-input" aria-describedby="sa-ai-code-hint" />
                <span id="sa-ai-code-hint" className="sa-ai-field-hint">Chữ, số, dấu gạch ngang hoặc gạch dưới.</span>
              </label>
            </div>
            <label className="sa-ai-label" htmlFor="sa-ai-plan-description">Mô tả <span className="sa-ai-optional">Tùy chọn</span>
              <textarea id="sa-ai-plan-description" maxLength={1000} rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Gói phù hợp với doanh nghiệp nào?" className="sa-ai-input" />
            </label>
          </fieldset>

          <fieldset className="sa-ai-fieldset" disabled={saving}>
            <legend>Giá & quyền sử dụng</legend>
            <label className="sa-ai-label" htmlFor="sa-ai-plan-price">Giá trọn gói <span className="sa-ai-required">*</span>
              <span className="sa-ai-input-with-unit"><input id="sa-ai-plan-price" type="number" inputMode="numeric" required min={0} max={1000000000} step={1} value={form.priceVnd} onChange={(event) => setForm({ ...form, priceVnd: event.target.value })} placeholder="Ví dụ: 99000" className="sa-ai-input" aria-describedby="sa-ai-price-hint" /><span aria-hidden="true">VND</span></span>
              <span id="sa-ai-price-hint" className="sa-ai-field-hint">{previewPrice} cho toàn bộ kỳ sử dụng. Nhập 0 nếu miễn phí.</span>
            </label>
            <div className="sa-ai-two-fields">
              <label className="sa-ai-label" htmlFor="sa-ai-plan-limit">Số lượt AI trong gói <span className="sa-ai-required">*</span>
                <span className="sa-ai-input-with-unit"><input id="sa-ai-plan-limit" type="number" inputMode="numeric" required min={1} max={10000000} step={1} value={form.aiLimit} onChange={(event) => setForm({ ...form, aiLimit: event.target.value })} placeholder="Ví dụ: 1000" className="sa-ai-input" aria-describedby="sa-ai-limit-hint" /><span aria-hidden="true">lượt</span></span>
                <span id="sa-ai-limit-hint" className="sa-ai-field-hint">Dùng chung cho toàn doanh nghiệp.</span>
              </label>
              <label className="sa-ai-label" htmlFor="sa-ai-plan-duration">Thời hạn sử dụng <span className="sa-ai-required">*</span>
                <span className="sa-ai-input-with-unit"><input id="sa-ai-plan-duration" type="number" inputMode="numeric" required min={1} max={3660} step={1} value={form.durationDays} onChange={(event) => setForm({ ...form, durationDays: event.target.value })} className="sa-ai-input" /><span aria-hidden="true">ngày</span></span>
                <span className="sa-ai-field-hint">Tính từ thời điểm cấp gói.</span>
              </label>
            </div>
            <div className="sa-ai-presets" role="group" aria-label="Chọn nhanh thời hạn">
              <span>Chọn nhanh:</span>{[30, 90, 180, 365].map((days) => <button key={days} type="button" aria-pressed={durationDays === days} onClick={() => setForm({ ...form, durationDays: String(days) })}>{days} ngày</button>)}
            </div>
            <label className="sa-ai-availability" htmlFor="sa-ai-plan-active">
              <span><strong>Cho phép cấp gói mới</strong><span className="sa-ai-muted">Hiển thị gói để doanh nghiệp lựa chọn.</span></span>
              <input id="sa-ai-plan-active" type="checkbox" role="switch" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            </label>
          </fieldset>

          <fieldset className="sa-ai-fieldset" disabled={saving}>
            <legend>Ghi chú quản lý</legend>
            <label className="sa-ai-label" htmlFor="sa-ai-plan-reason">Lý do thay đổi <span className="sa-ai-required">*</span>
              <textarea id="sa-ai-plan-reason" required minLength={3} maxLength={500} rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder={plan ? "Ví dụ: Điều chỉnh hạn mức cho kỳ cấp tiếp theo" : "Ví dụ: Bổ sung gói AI cho doanh nghiệp nhỏ"} className="sa-ai-input" aria-describedby="sa-ai-reason-hint" />
              <span id="sa-ai-reason-hint" className="sa-ai-field-hint">Ghi chú nội bộ, không hiển thị cho doanh nghiệp.</span>
            </label>
          </fieldset>
        </div>

        <aside className="sa-ai-editor-preview" aria-label="Xem trước thông tin gói">
          <p className="sa-ai-eyebrow">Xem trước gói</p>
          <div className="sa-ai-preview-card">
            <span className="sa-ai-preview-icon"><Sparkles size={23} aria-hidden="true" /></span>
            <h4>{form.name.trim() || "Tên gói AI"}</h4>
            <span className="sa-ai-code">{form.code || "MÃ GÓI"}</span>
            {form.description.trim() && <p className="sa-ai-preview-description">{form.description}</p>}
            <p className="sa-ai-preview-price"><strong>{previewPrice}</strong><span> / {previewDuration}</span></p>
            <div className="sa-ai-preview-quota"><strong>{previewLimit}</strong><span>lượt AI / kỳ</span></div>
            <p className="sa-ai-preview-duration"><Clock3 size={17} aria-hidden="true" />Thời hạn {previewDuration}</p>
            <div className="sa-ai-preview-features"><p><Check size={16} aria-hidden="true" />Dùng chung cho doanh nghiệp</p><p><Check size={16} aria-hidden="true" />Thành công mới tính lượt</p><p><Layers3 size={16} aria-hidden="true" />{form.active ? "Đang cung cấp" : "Ngừng cấp mới"}</p></div>
          </div>
          <div className="sa-ai-help"><Info size={17} aria-hidden="true" /><p>Thay đổi gói áp dụng cho lần cấp tiếp theo. Kỳ đang sử dụng giữ hạn mức đã được cấp.</p></div>
        </aside>
      </div>

      <footer className="sa-ai-dialog-footer">
        {error && <div className="sa-ai-feedback sa-ai-feedback-error" role="alert"><TriangleAlert size={18} aria-hidden="true" />{error}</div>}
        <div className="sa-ai-dialog-actions"><span className="sa-ai-muted"><span className="sa-ai-required">*</span> Thông tin bắt buộc</span><div>
          <button type="button" disabled={saving} onClick={onClose} className="sa-ai-button sa-ai-button-secondary">Hủy</button>
          <button type="submit" disabled={saving} className="sa-ai-button sa-ai-button-primary">{saving ? <Loader2 size={17} className="sa-ai-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}{saving ? "Đang lưu…" : plan ? "Lưu thay đổi" : "Tạo gói AI"}</button>
        </div></div>
      </footer>
    </form>
  </dialog>;
}
