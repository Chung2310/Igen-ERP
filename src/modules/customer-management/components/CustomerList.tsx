import { ChevronLeft, ChevronRight, ClipboardList, Link2, Search, ShoppingBag, Wrench } from "lucide-react";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { StudentEmptyIllustration } from "../../student-management/components/Erp/StudentEmptyIllustration";
import type { Customer, CustomerListQuery, CustomerModule, CustomerStatus, CustomerType } from "../types";
import type { CustomerDetailSection } from "../navigation";
import { customerInvoiceLabels, customerKindLabels, customerModuleLabels } from "../customerLabels";

type Props = {
  items: Customer[]; total: number; page: number; limit: number;
  query: string; status: CustomerStatus; type: "" | CustomerType;
  customerKind?: CustomerListQuery["customerKind"];
  linkedModules?: Record<string, CustomerModule[]>;
  onQueryChange: (value: string) => void; onStatusChange: (value: CustomerStatus) => void;
  onTypeChange: (value: "" | CustomerType) => void; onPageChange: (value: number) => void;
  onCustomerKindChange: (value: CustomerListQuery["customerKind"]) => void;
  canViewModuleLinks: boolean; canViewLeadNeeds: boolean; canRetailRead: boolean; canRepairRead: boolean;
  onOpen: (customer: Customer, section?: CustomerDetailSection) => void;
  onEdit?: (customer: Customer) => void;
};

const kinds = [
  { value: "all", label: "Tất cả đối tượng" },
  ...Object.entries(customerKindLabels).map(([value, label]) => ({ value, label })),
];
const invoices = [
  { value: "all", label: "Tất cả chế độ hóa đơn" },
  ...Object.entries(customerInvoiceLabels).map(([value, label]) => ({ value, label })),
];

export default function CustomerList(props: Props) {
  const sections = [
    { id: "module-links", label: "Hồ sơ liên kết", icon: Link2, visible: props.canViewModuleLinks },
    { id: "lead-needs", label: "Nhu cầu từ Lead", icon: ClipboardList, visible: props.canViewLeadNeeds },
    { id: "purchases", label: "Mua hàng & bảo hành", icon: ShoppingBag, visible: props.canRetailRead },
    { id: "repairs", label: "Sửa chữa", icon: Wrench, visible: props.canRepairRead },
  ] as const;
  const availableSections = sections.filter(section => section.visible);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
          <input aria-label="Tìm khách hàng" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Mã, tên, số điện thoại hoặc email" className="h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/70 focus:border-primary" />
        </label>
        <StyledSelect ariaLabel="Đối tượng khách hàng" value={props.customerKind || "all"} onChange={value => props.onCustomerKindChange(value === "all" ? undefined : value as CustomerListQuery["customerKind"])} options={kinds} className="rounded-md" menuClassName="rounded-md shadow-sm" />
        <StyledSelect ariaLabel="Chế độ hóa đơn" value={props.type || "all"} onChange={value => props.onTypeChange(value === "all" ? "" : value as CustomerType)} options={invoices} className="rounded-md" menuClassName="rounded-md shadow-sm" />
        <StyledSelect ariaLabel="Trạng thái" value={props.status} onChange={(value) => props.onStatusChange(value as CustomerStatus)} options={[{ value: "active", label: "Đang hoạt động" }, { value: "inactive", label: "Ngừng hoạt động" }]} className="rounded-md" menuClassName="rounded-md shadow-sm" />
      </div>

      <div className="flex flex-1 flex-col rounded-md border border-outline-variant bg-surface-container-lowest">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-low text-sm font-medium text-on-surface">
            <tr><th scope="col" className="px-3 py-3 font-medium">Khách hàng</th><th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Liên hệ</th><th scope="col" className="hidden px-3 py-3 font-medium xl:table-cell">Hóa đơn</th><th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Trạng thái</th><th scope="col" className="px-3 py-3 font-medium">{availableSections.length ? "Hồ sơ và hoạt động" : "Hồ sơ"}</th></tr>
          </thead>
          <tbody>
            {props.items.map((customer) => (
              <tr key={customer._id} className="border-t border-outline-variant align-top text-on-surface hover:bg-surface-container-low/50">
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <p className="wrap-anywhere font-medium">{customer.name}</p>
                  <p className="mt-1 wrap-anywhere text-xs tabular-nums text-on-surface-variant">{customer.customerCode}</p>
                  <span className="mt-1 inline-flex rounded-md border border-outline-variant px-2 py-0.5 text-xs text-on-surface">{customerKindLabels[customer.customerKind ?? "unclassified"] ?? customerKindLabels.unclassified}</span>
                  {customer.type === "vat" && <p className="mt-1 break-words text-xs text-on-surface-variant xl:hidden">{customerInvoiceLabels.vat}</p>}
                  <p className="mt-1 wrap-anywhere text-xs tabular-nums text-on-surface-variant md:hidden">{customer.phone}</p>
                  <p className="mt-1 text-xs text-on-surface-variant md:hidden">{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</p>
                </th>
                <td className="hidden px-3 py-3 md:table-cell">
                  <p className="tabular-nums">{customer.phone}</p>
                  {customer.email && <p className="mt-1 wrap-anywhere text-xs text-on-surface-variant">{customer.email}</p>}
                </td>
                <td className="hidden px-3 py-3 xl:table-cell">
                  <p>{customerInvoiceLabels[customer.type]}</p>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${customer.status === "active" ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
                  {customer.tier && <p className="mt-1 text-xs text-on-surface-variant">Hạng {customer.tier.name}</p>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <button type="button" aria-label={`Chi tiết ${customer.name}`} onClick={() => props.onOpen(customer)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm font-semibold text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary">
                      Mở hồ sơ <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    </button>
                    {props.onEdit && <button type="button" aria-label={`Sửa hồ sơ ${customer.name}`} onClick={() => props.onEdit?.(customer)} className="min-h-9 rounded-md px-1 text-sm text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary">Sửa</button>}
                  </div>
                  {availableSections.length > 0 && <div className="flex flex-wrap gap-1.5 pb-1">
                    {availableSections.map(({ id, label, icon: Icon }) => {
                      const roles = id === "module-links" ? props.linkedModules?.[customer._id] : undefined;
                      const text = roles?.length ? roles.map(role => customerModuleLabels[role]).join(" · ") : label;
                      return <button key={id} type="button" aria-label={`${label} của ${customer.name}${roles?.length ? ` (${text})` : ""}`} onClick={() => props.onOpen(customer, id)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-left text-xs font-medium text-on-surface hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
                        <Icon className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />{text}
                      </button>;
                    })}
                  </div>}
                </td>
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
