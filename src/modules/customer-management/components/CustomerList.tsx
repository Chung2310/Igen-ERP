import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { StudentEmptyIllustration } from "../../student-management/components/Erp/StudentEmptyIllustration";
import type { Customer, CustomerStatus, CustomerType } from "../types";

type Props = {
  items: Customer[]; total: number; page: number; limit: number;
  query: string; status: CustomerStatus; type: "" | CustomerType;
  onQueryChange: (value: string) => void; onStatusChange: (value: CustomerStatus) => void;
  onTypeChange: (value: "" | CustomerType) => void; onPageChange: (value: number) => void;
  onOpen: (customer: Customer) => void;
};

export default function CustomerList(props: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
          <input aria-label="Tìm khách hàng" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Mã, tên, số điện thoại hoặc email" className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary" />
        </label>
        <StyledSelect ariaLabel="Trạng thái" value={props.status} onChange={(value) => props.onStatusChange(value as CustomerStatus)} options={[{ value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Ngừng hoạt động" }]} className="rounded-md" menuClassName="rounded-md shadow-sm" />
        <StyledSelect ariaLabel="Loại khách" value={props.type || "all"} onChange={(value) => props.onTypeChange(value === "all" ? "" : value as CustomerType)} options={[{ value: "all", label: "Tất cả loại khách" }, { value: "regular", label: "Khách thường" }, { value: "vat", label: "Khách xuất VAT" }]} className="rounded-md" menuClassName="rounded-md shadow-sm" />
      </div>

      <div className="flex flex-1 flex-col rounded-md border border-outline-variant bg-surface-container-lowest">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface-container-low text-sm font-medium text-on-surface">
            <tr><th scope="col" className="px-3 py-3 font-medium">Mã khách</th><th scope="col" className="px-3 py-3 font-medium">Khách hàng</th><th scope="col" className="px-3 py-3 font-medium">Điện thoại</th><th scope="col" className="px-3 py-3 font-medium">Hạng</th><th scope="col" className="px-3 py-3 font-medium">Loại</th><th scope="col" className="px-3 py-3 font-medium">Trạng thái</th><th scope="col" className="px-3 py-3 text-right font-medium">Thao tác</th></tr>
          </thead>
          <tbody>
            {props.items.map((customer) => (
              <tr key={customer._id} className="border-t border-outline-variant text-on-surface transition hover:bg-surface-container-low">
                <td className="px-3 py-3 font-medium text-primary">{customer.customerCode}</td>
                <td className="px-3 py-3"><p className="font-medium text-on-surface">{customer.name}</p><p className="mt-0.5 text-xs text-on-surface-variant">{customer.email || "—"}</p></td>
                <td className="px-3 py-3 tabular-nums">{customer.phone}</td>
                <td className="px-3 py-3">{customer.tier ? <span className="inline-flex rounded-md bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">{customer.tier.name}</span> : <span className="text-xs text-on-surface-variant">Chưa xếp hạng</span>}</td>
                <td className="px-3 py-3"><p>{customer.customerKind === 'business' ? 'Doanh nghiệp / tổ chức' : customer.customerKind === 'individual' ? 'Cá nhân' : 'Chưa phân loại'}</p><p className="mt-0.5 text-xs text-on-surface-variant">{customer.type === "vat" ? "Xuất VAT" : "Thông thường"}</p></td>
                <td className="px-3 py-3"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${customer.status === "active" ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
                <td className="px-3 py-3 text-right"><button type="button" aria-label={`Chi tiết ${customer.name}`} onClick={() => props.onOpen(customer)} className="rounded-md px-3 py-1.5 font-medium text-primary transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!props.items.length && <div className="flex flex-1 flex-col items-center justify-center px-4 py-7 text-center"><StudentEmptyIllustration kind="partner" /><p className="mt-2 text-pretty text-sm text-on-surface-variant">Chưa có khách hàng phù hợp.</p></div>}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
        <span>{props.total} khách hàng</span>
        <div className="flex gap-2">
          <button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)} className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-on-surface transition hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden="true" />Trước</button>
          <button type="button" disabled={props.page * props.limit >= props.total} onClick={() => props.onPageChange(props.page + 1)} className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-on-surface transition hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Sau<ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}
