import { useState, type FormEvent } from "react";
import type { AssistantQuotationAcceptanceForm as AcceptanceFormData, AssistantQuotationAcceptanceLinesInput } from "../../shared/assistant-workflow";

interface AssistantQuotationAcceptanceFormProps {
  value: AcceptanceFormData;
  readOnly: boolean;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: (value: AssistantQuotationAcceptanceLinesInput) => void;
}

export function AssistantQuotationAcceptanceForm({ value, readOnly, submitting, canSubmit, onSubmit }: AssistantQuotationAcceptanceFormProps) {
  const [quantities, setQuantities] = useState(() => value.lines.map(line => line.acceptedQuantity === undefined ? "" : String(line.acceptedQuantity)));
  const [details, setDetails] = useState(() => value.lines.map(line => line.acceptedDetails || ""));
  const [error, setError] = useState("");
  const errorId = "assistant-acceptance-lines-error";

  const updateQuantity = (index: number, next: string) => {
    setQuantities(current => current.map((item, itemIndex) => itemIndex === index ? next : item));
    setError("");
  };

  const updateDetails = (index: number, next: string) => {
    setDetails(current => current.map((item, itemIndex) => itemIndex === index ? next : item));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || submitting || !canSubmit) return;
    const lines = value.lines.map((line, index) => ({
      lineIndex: line.lineIndex,
      acceptedQuantity: Number(quantities[index]),
      ...(details[index]?.trim() ? { acceptedDetails: details[index].trim() } : {}),
    }));
    const hasEmpty = quantities.some(quantity => !quantity.trim());
    if (hasEmpty) {
      setError("Nhập khối lượng nghiệm thu cho từng dòng. Dùng 0 nếu sản phẩm không được nghiệm thu.");
      return;
    }
    const invalidIndex = lines.findIndex((line, index) => !Number.isFinite(line.acceptedQuantity)
      || line.acceptedQuantity < 0
      || line.acceptedQuantity > value.lines[index].contractQuantity);
    if (invalidIndex >= 0) {
      setError(`Khối lượng dòng ${value.lines[invalidIndex].lineIndex} phải từ 0 đến ${value.lines[invalidIndex].contractQuantity} ${value.lines[invalidIndex].unit}.`);
      return;
    }
    if (!lines.some(line => line.acceptedQuantity > 0)) {
      setError("Cần có ít nhất một dòng có khối lượng nghiệm thu lớn hơn 0.");
      return;
    }
    onSubmit({ lines });
  };

  if (readOnly) return <section aria-labelledby="assistant-acceptance-lines-title" className="max-w-4xl overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest text-sm">
    <header className="border-b border-outline-variant px-3 py-2 sm:px-4">
      <h3 id="assistant-acceptance-lines-title" className="text-balance font-semibold">Khối lượng nghiệm thu{value.contractNumber ? ` · Hợp đồng ${value.contractNumber}` : ""}</h3>
      <p className="mt-1 text-pretty text-xs text-on-surface-variant">Kiểm tra số lượng và thông tin nghiệm thu từng sản phẩm trước khi xác nhận.</p>
    </header>
    <ol className="space-y-2 p-3 sm:p-4">
      {value.lines.map(line => <li key={line.lineIndex} className="rounded-lg border border-outline-variant bg-surface p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-semibold text-on-surface">{line.name}</h4>
            {line.sku && <p className="mt-0.5 text-xs text-on-surface-variant">{line.sku}</p>}
            {line.description && <p className="mt-1 text-xs text-on-surface-variant">{line.description}</p>}
          </div>
          <span className="shrink-0 rounded-md bg-surface-container-low px-2 py-1 text-xs tabular-nums text-on-surface-variant">Dòng {line.lineIndex}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-surface-container-low p-2">
            <dt className="text-xs text-on-surface-variant">Theo hợp đồng</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-on-surface">{line.contractQuantity} {line.unit}</dd>
          </div>
          <div className="rounded-md bg-surface-container-low p-2">
            <dt className="text-xs text-on-surface-variant">Khối lượng nghiệm thu</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-on-surface">{line.acceptedQuantity ?? "Chưa nhập"}{line.acceptedQuantity === undefined ? "" : ` ${line.unit}`}</dd>
          </div>
        </dl>
        <dl className="mt-2 rounded-md border border-outline-variant px-2 py-1.5">
          <dt className="text-xs text-on-surface-variant">Thông tin nghiệm thu sản phẩm</dt>
          <dd className="mt-0.5 break-words text-on-surface">{line.acceptedDetails?.trim() || "Không có ghi chú"}</dd>
        </dl>
      </li>)}
    </ol>
  </section>;

  return <section aria-labelledby="assistant-acceptance-lines-title" className="@container max-w-4xl overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest text-sm">
    <header className="border-b border-outline-variant px-3 py-2 sm:px-4">
      <h3 id="assistant-acceptance-lines-title" className="text-balance font-semibold">Khối lượng nghiệm thu{value.contractNumber ? ` · Hợp đồng ${value.contractNumber}` : ""}</h3>
      <p className="mt-1 text-pretty text-xs text-on-surface-variant">Nhập số lượng nghiệm thu cho từng sản phẩm; dùng 0 nếu không nghiệm thu dòng đó.</p>
    </header>
    <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-3 p-3 sm:p-4">
      <div className="@3xl:hidden space-y-3">
        {value.lines.map((line, index) => {
          const quantityId = `assistant-acceptance-quantity-card-${line.lineIndex}`;
          const detailsId = `assistant-acceptance-details-card-${line.lineIndex}`;
          const invalidQuantity = Boolean(error && (!quantities[index]?.trim()
            || !Number.isFinite(Number(quantities[index]))
            || Number(quantities[index]) < 0
            || Number(quantities[index]) > line.contractQuantity));
          return <article key={line.lineIndex} aria-labelledby={`assistant-acceptance-line-${line.lineIndex}-title`} className="space-y-3 rounded-lg border border-outline-variant bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 id={`assistant-acceptance-line-${line.lineIndex}-title`} className="font-semibold text-on-surface">{line.name}</h4>
                {line.sku && <p className="mt-0.5 text-xs text-on-surface-variant">{line.sku}</p>}
                {line.description && <p className="mt-1 text-xs text-on-surface-variant">{line.description}</p>}
              </div>
              <span className="shrink-0 rounded-md bg-surface-container-low px-2 py-1 text-xs tabular-nums text-on-surface-variant">Dòng {line.lineIndex}</span>
            </div>
            <p className="text-xs text-on-surface-variant">Theo hợp đồng: <span className="font-medium tabular-nums text-on-surface">{line.contractQuantity} {line.unit}</span></p>
            <div className="space-y-1">
              <label htmlFor={quantityId} className="block text-xs font-medium text-on-surface">Khối lượng nghiệm thu</label>
              <input id={quantityId} type="number" min={0} max={line.contractQuantity} step="any" inputMode="decimal" value={quantities[index] || ""} disabled={readOnly || submitting} required aria-invalid={invalidQuantity} aria-describedby={error ? errorId : undefined} onChange={event => updateQuantity(index, event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-outline-variant bg-surface px-2.5 py-1.5 text-sm tabular-nums text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
            <div className="space-y-1">
              <label htmlFor={detailsId} className="block text-xs font-medium text-on-surface">Thông tin nghiệm thu sản phẩm</label>
              <input id={detailsId} type="text" maxLength={1000} value={details[index] || ""} disabled={readOnly || submitting} placeholder="Tình trạng, ghi chú…" onChange={event => updateDetails(index, event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
          </article>;
        })}
      </div>
      <div className="hidden @3xl:block overflow-x-auto rounded-lg border border-outline-variant">
        <table className="min-w-max w-full border-collapse text-left">
          <caption className="sr-only">Sản phẩm và số lượng trong hợp đồng cùng thông tin nghiệm thu cần nhập</caption>
          <thead className="bg-surface-container-low text-xs text-on-surface-variant">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 font-medium">Dòng</th>
              <th scope="col" className="min-w-52 px-3 py-2 font-medium">Sản phẩm</th>
              <th scope="col" className="w-36 px-3 py-2 font-medium">Theo hợp đồng</th>
              <th scope="col" className="w-44 px-3 py-2 font-medium">Khối lượng nghiệm thu</th>
              <th scope="col" className="min-w-64 px-3 py-2 font-medium">Thông tin nghiệm thu sản phẩm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {value.lines.map((line, index) => {
              const quantityId = `assistant-acceptance-quantity-${line.lineIndex}`;
              const detailsId = `assistant-acceptance-details-${line.lineIndex}`;
              const invalidQuantity = Boolean(error && (!quantities[index]?.trim()
                || !Number.isFinite(Number(quantities[index]))
                || Number(quantities[index]) < 0
                || Number(quantities[index]) > line.contractQuantity));
              return <tr key={line.lineIndex}>
                <th scope="row" className="px-3 py-2.5 align-top font-medium tabular-nums text-on-surface">{line.lineIndex}</th>
                <td className="px-3 py-2.5 align-top">
                  <p className="font-medium text-on-surface">{line.name}</p>
                  {line.sku && <p className="mt-0.5 text-xs text-on-surface-variant">{line.sku}</p>}
                  {line.description && <p className="mt-1 max-w-sm text-xs text-on-surface-variant">{line.description}</p>}
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums text-on-surface">{line.contractQuantity} {line.unit}</td>
                <td className="relative px-3 py-2.5 align-top">
                  <label htmlFor={quantityId} className="sr-only absolute left-0 top-0">Khối lượng nghiệm thu cho {line.name}</label>
                  <input id={quantityId} type="number" min={0} max={line.contractQuantity} step="any" inputMode="decimal" value={quantities[index] || ""} disabled={readOnly || submitting} required aria-invalid={invalidQuantity} aria-describedby={error ? errorId : undefined} onChange={event => updateQuantity(index, event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-outline-variant bg-surface px-2.5 py-1.5 text-sm tabular-nums text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                </td>
                <td className="relative px-3 py-2.5 align-top">
                  <label htmlFor={detailsId} className="sr-only absolute left-0 top-0">Thông tin nghiệm thu sản phẩm {line.name}</label>
                  <input id={detailsId} type="text" maxLength={1000} value={details[index] || ""} disabled={readOnly || submitting} placeholder="Tình trạng, ghi chú…" onChange={event => updateDetails(index, event.currentTarget.value)} className="min-h-10 w-full rounded-md border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {error && <p id={errorId} role="alert" className="text-pretty text-sm text-error">{error}</p>}
      <button type="submit" disabled={readOnly || submitting || !canSubmit} className="min-h-10 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {submitting ? "Đang gửi…" : "Gửi khối lượng nghiệm thu"}
      </button>
    </form>
  </section>;
}
