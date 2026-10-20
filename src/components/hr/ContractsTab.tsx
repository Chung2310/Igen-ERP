import React, { useEffect, useMemo, useState } from "react";
import {
  FileSignature,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { FilePreviewModal } from "../resource/FilePreviewModal";
import { DateInput24 } from "../common/TimeInput24";
import { HrFormSelect } from "./HrFormSelect";
import type { ResourceItem } from "../../types";

type ContractStatus = "draft" | "active" | "expired" | "terminated";
type Contract = {
  _id: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  contractFileUrl?: string;
  contractFileName?: string;
  contractFileMimeType?: string;
  contractFileSize?: number;
  contractResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  note?: string;
};
type Employee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
};
type Extension = {
  _id: string;
  contractId: string;
  employeeName: string;
  previousEndDate: string;
  newEndDate: string;
  extensionDate: string;
  reason?: string;
  extensionFileUrl?: string;
  extensionFileName?: string;
  extensionFileMimeType?: string;
  extensionFileSize?: number;
  extensionResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
};
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAccessToken()}`,
});
const date = (value?: string) =>
  value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—";
const isoDate = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const fileNameFromUrl = (url: string, fallback: string) => {
  try {
    const name = decodeURIComponent(
      new URL(url).pathname.split("/").pop() || "",
    );
    return name.includes(".") ? name : fallback;
  } catch {
    return fallback;
  }
};
const mimeFromName = (name: string) => {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "doc") return "application/msword";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || ""))
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
  return "";
};
const daysUntilExpiry = (value: string, now = new Date()) => {
  const expiry = new Date(value);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate(),
  );
  return Math.ceil((expiryUtc - todayUtc) / 86_400_000);
};
const isExpiringSoon = (contract: Contract) => {
  const remaining = daysUntilExpiry(contract.endDate);
  return contract.status === "active" && remaining >= 1 && remaining <= 20;
};
const emptyContract = {
  contractType: "Hợp đồng xác định thời hạn",
  employeeId: "",
  startDate: "",
  endDate: "",
  status: "active" as ContractStatus,
  contractFileUrl: "",
  contractFileName: "",
  contractFileMimeType: "",
  contractFileSize: 0,
  contractResourceId: "",
  contractFileUploadToken: "",
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  signedImageUploadToken: "",
  note: "",
};
const emptyExtension = {
  contractId: "",
  newEndDate: "",
  extensionDate: new Date().toISOString().slice(0, 10),
  reason: "",
  extensionFileUrl: "",
  extensionFileName: "",
  extensionFileMimeType: "",
  extensionFileSize: 0,
  extensionResourceId: "",
  extensionFileUploadToken: "",
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  extensionSignedImageUploadToken: "",
};
const input =
  "w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2.5 text-xs text-slate-700 outline-none transition focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15";
const statusLabel: Record<ContractStatus, string> = {
  draft: "Bản nháp",
  active: "Còn hiệu lực",
  expired: "Hết hạn",
  terminated: "Đã chấm dứt",
};
const statusStyle: Record<ContractStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
  terminated: "bg-rose-50 text-rose-700",
};

export default function ContractsTab({
  canManage,
  companyCode,
  branchId,
}: {
  canManage: boolean;
  companyCode: string;
  branchId?: string;
}) {
  const [tab, setTab] = useState<"contracts" | "extensions">("contracts");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [extOpen, setExtOpen] = useState(false);
  const [extensionForm, setExtensionForm] = useState(emptyExtension);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<
    "contract" | "signed" | "extension" | "extensionSigned" | null
  >(null);
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);
  const suffix = `?companyCode=${encodeURIComponent(companyCode)}${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`;

  const load = async (currentPage = page, currentSearch = debouncedSearch) => {
    setLoading(true);
    try {
      const contractSuffix = `${suffix}&page=${currentPage}&limit=${limit}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`;
      const [a, b] = await Promise.all([
        fetch(`/api/v1/hr-contracts${contractSuffix}`, { headers: headers() }),
        fetch(`/api/v1/hr-contracts/extensions/list${suffix}`, {
          headers: headers(),
        }),
      ]);
      const ar = await a.json();
      const br = await b.json();
      if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
      setContracts(ar.data?.contracts || []);
      setEmployees(ar.data?.employees || []);
      setTotal(ar.data?.total || 0);
      setExtensions(br.data || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu hợp đồng."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    load(page, debouncedSearch);
  }, [companyCode, branchId, page, debouncedSearch]);
  const contractsByEmployee = useMemo(
    () =>
      new Map(
        employees.map((e) => [
          e._id,
          contracts.filter((c) => c.employeeId === e._id),
        ]),
      ),
    [employees, contracts],
  );
  const expiringContracts = useMemo(
    () =>
      contracts
        .filter(isExpiringSoon)
        .sort(
          (a, b) => daysUntilExpiry(a.endDate) - daysUntilExpiry(b.endDate),
        ),
    [contracts],
  );
  const visibleEmployees = employees.filter((e) =>
    `${e.displayName || ""} ${e.email} ${e.department || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const openContract = (contract?: Contract) => {
    setEditing(contract || "new");
    setContractForm(
      contract
        ? {
            contractType: contract.contractType,
            employeeId: contract.employeeId,
            startDate: isoDate(contract.startDate),
            endDate: isoDate(contract.endDate),
            status: contract.status,
            contractFileUrl: contract.contractFileUrl || "",
            contractFileName: contract.contractFileName || "",
            contractFileMimeType: contract.contractFileMimeType || "",
            contractFileSize: contract.contractFileSize || 0,
            contractResourceId: contract.contractResourceId || "",
            contractFileUploadToken: "",
            signedImageUrl: contract.signedImageUrl || "",
            signedImageName: contract.signedImageName || "",
            signedImageMimeType: contract.signedImageMimeType || "",
            signedImageSize: contract.signedImageSize || 0,
            signedImageResourceId: contract.signedImageResourceId || "",
            signedImageUploadToken: "",
            note: contract.note || "",
          }
        : emptyContract,
    );
  };
  const saveContract = async () => {
    setSaving(true);
    try {
      const url =
        editing === "new"
          ? `/api/v1/hr-contracts${suffix}`
          : `/api/v1/hr-contracts/${(editing as Contract)._id}${suffix}`;
      const res = await fetch(url, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: headers(),
        body: JSON.stringify(contractForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã lưu hợp đồng.");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể lưu hợp đồng."));
    } finally {
      setSaving(false);
    }
  };
  const openExtension = (contract?: Contract) => {
    setExtensionForm({
      ...emptyExtension,
      contractId: contract?._id || "",
      newEndDate: contract ? isoDate(contract.endDate) : "",
    });
    setExtOpen(true);
    setTab("extensions");
  };
  const saveExtension = async () => {
    setSaving(true);
    try {
      const { contractId, ...body } = extensionForm;
      const res = await fetch(
        `/api/v1/hr-contracts/${contractId}/extensions${suffix}`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã gia hạn hợp đồng.");
      setExtOpen(false);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể gia hạn hợp đồng."));
    } finally {
      setSaving(false);
    }
  };
  const uploadContractFile = async (
    file: File,
    target: "contract" | "signed",
  ) => {
    const allowed =
      target === "signed"
        ? file.type.startsWith("image/")
        : [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type);
    if (!allowed)
      return toast.error(
        target === "signed"
          ? "Ảnh đã ký phải là tệp hình ảnh."
          : "Hợp đồng chỉ hỗ trợ PDF, DOC hoặc DOCX.",
      );
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Tệp tải lên không được vượt quá 10 MB.");
    setUploading(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/v1/hr-contracts/upload${suffix}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          file: base64,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind: target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tải tệp thất bại.");
      setContractForm((current) =>
        target === "signed"
          ? {
              ...current,
              signedImageUrl: data.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: "",
              signedImageUploadToken: data.data.uploadToken,
            }
          : {
              ...current,
              contractFileUrl: data.data.url,
              contractFileName: file.name,
              contractFileMimeType: file.type,
              contractFileSize: file.size,
              contractResourceId: "",
              contractFileUploadToken: data.data.uploadToken,
            },
      );
      toast.success(`Đã tải lên ${file.name}.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải tệp hợp đồng."));
    } finally {
      setUploading(null);
    }
  };
  const uploadExtensionFile = async (
    file: File,
    target: "extension" | "extensionSigned",
  ) => {
    const isSigned = target === "extensionSigned";
    const allowed = isSigned
      ? file.type.startsWith("image/")
      : [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(file.type);
    if (!allowed)
      return toast.error(
        isSigned
          ? "Ảnh đã ký phải là tệp hình ảnh."
          : "Phụ lục gia hạn chỉ hỗ trợ PDF, DOC hoặc DOCX.",
      );
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Tệp tải lên không được vượt quá 10 MB.");
    setUploading(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/v1/hr-contracts/upload${suffix}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          file: base64,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind: target,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Tải tệp thất bại.");
      setExtensionForm((current) =>
        isSigned
          ? {
              ...current,
              signedImageUrl: result.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: "",
              extensionSignedImageUploadToken: result.data.uploadToken,
            }
          : {
              ...current,
              extensionFileUrl: result.data.url,
              extensionFileName: file.name,
              extensionFileMimeType: file.type,
              extensionFileSize: file.size,
              extensionResourceId: "",
              extensionFileUploadToken: result.data.uploadToken,
            },
      );
      toast.success(`Đã tải lên ${file.name}.`);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể tải tệp gia hạn hợp đồng."),
      );
    } finally {
      setUploading(null);
    }
  };
  const preview = async (contract: Contract, kind: "contract" | "signed") => {
    const signed = kind === "signed";
    const fileUrl = signed ? contract.signedImageUrl : contract.contractFileUrl;
    if (!fileUrl) return;
    const resourceId = signed
      ? contract.signedImageResourceId
      : contract.contractResourceId;
    if (resourceId) {
      try {
        const response = await fetch(`/api/v1/resources/${resourceId}`, {
          headers: headers(),
        });
        const result = await response.json();
        if (response.ok && result.item?.fileUrl) {
          setPreviewItem(result.item);
          return;
        }
      } catch (error) {
        console.warn(
          "Không tải được ResourceItem của hợp đồng, dùng metadata dự phòng:",
          error,
        );
      }
    }
    const storedName = signed
      ? contract.signedImageName
      : contract.contractFileName;
    const name =
      storedName ||
      fileNameFromUrl(
        fileUrl,
        signed ? "anh-hop-dong-da-ky.jpg" : "hop-dong.pdf",
      );
    setPreviewItem({
      _id: resourceId || `${contract._id}-${kind}`,
      companyCode,
      section: "local",
      type: "file",
      name,
      parentId: null,
      fileUrl,
      mimeType:
        (signed
          ? contract.signedImageMimeType
          : contract.contractFileMimeType) || mimeFromName(name),
      size: signed ? contract.signedImageSize : contract.contractFileSize,
      createdAt: "",
      updatedAt: "",
    });
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#F5F8FC] p-4 text-left md:p-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE7F4] bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F7FF] text-[#00A4E8]">
              <FileSignature size={19} />
            </span>
            <div>
              <h2 className="text-base font-medium text-slate-800">
                Quản lý hợp đồng
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Theo dõi hợp đồng và lịch sử gia hạn của từng nhân viên.
              </p>
            </div>
          </div>
          {canManage && tab === "contracts" && (
            <button
              onClick={() => openContract()}
              className="flex items-center gap-1.5 rounded-xl bg-[#00A4E8] px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#008FCB]"
            >
              <Plus size={15} />
              Tạo hợp đồng
            </button>
          )}
        </div>
        <div className="flex w-fit gap-1 rounded-xl border border-[#DCE7F4] bg-[#F0F6FB] p-1">
          <button
            type="button"
            onClick={() => setTab("contracts")}
            className={`rounded-lg px-4 py-2 text-xs font-normal transition-colors ${tab === "contracts" ? "bg-white text-[#007EB8] shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
          >
            Danh sách hợp đồng
          </button>
          <button
            type="button"
            onClick={() => setTab("extensions")}
            className={`rounded-lg px-4 py-2 text-xs font-normal transition-colors ${tab === "extensions" ? "bg-white text-[#007EB8] shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
          >
            Gia hạn hợp đồng
          </button>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-[#DCE7F4] bg-white p-12 text-center text-xs text-slate-500">
            Đang tải hợp đồng...
          </div>
        ) : tab === "contracts" ? (
          <>
            {expiringContracts.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800">
                <p className="text-xs font-medium">
                  Có {expiringContracts.length} hợp đồng sắp hết hạn trong 20
                  ngày tới
                </p>
                <p className="mt-1 text-[11px] text-amber-700">
                  {expiringContracts
                    .slice(0, 5)
                    .map(
                      (contract) =>
                        `${contract.employeeName} (${daysUntilExpiry(contract.endDate)} ngày)`,
                    )
                    .join(" · ")}
                  {expiringContracts.length > 5
                    ? ` · và ${expiringContracts.length - 5} hợp đồng khác`
                    : ""}
                </p>
              </div>
            )}
            <div className="relative max-w-sm">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={15}
              />
              <input
                className={input + " pl-9"}
                placeholder="Tìm nhân viên, email, phòng ban..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#DCE7F4] bg-white shadow-sm">
              <table className="w-full min-w-[820px] text-xs text-slate-700">
                <thead className="bg-[#F1F8FC] text-slate-600">
                  <tr>
                    <th className="border-r border-[#E8EEF5] p-3 text-left font-medium">Nhân viên</th>
                    <th className="border-r border-[#E8EEF5] p-3 text-left font-medium">Loại hợp đồng</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Bắt đầu</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Hết hạn</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Trạng thái</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Tài liệu</th>
                    <th className="p-3 font-normal"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EEF5]">
                  {contracts.map((c) => {
                    const remainingDays = daysUntilExpiry(c.endDate);
                    const expiringSoon = isExpiringSoon(c);
                    const emp = employees.find((e) => e._id === c.employeeId);
                    return (
                      <tr
                        key={c._id}
                        className={`transition-colors hover:bg-[#F8FCFF] ${expiringSoon ? "bg-amber-50/50" : ""}`}
                      >
                        <td className="border-r border-[#EEF3F8] p-3">
                          <span className="font-medium text-slate-800">{c.employeeName}</span>
                          {emp && (
                            <div className="text-[10px] text-slate-400">
                              {emp.department}
                            </div>
                          )}
                        </td>
                        <td className="border-r border-[#EEF3F8] p-3">{c.contractType}</td>
                        <td className="border-r border-[#EEF3F8] p-3 text-center">
                          {date(c.startDate)}
                        </td>
                        <td className="border-r border-[#EEF3F8] p-3 text-center">
                          <div>{date(c.endDate)}</div>
                          {expiringSoon && (
                            <span className="mt-1 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-normal text-amber-700">
                              Sắp hết hạn · Còn {remainingDays} ngày
                            </span>
                          )}
                        </td>
                        <td className="border-r border-[#EEF3F8] p-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-normal ${statusStyle[c.status]}`}
                          >
                            {statusLabel[c.status]}
                          </span>
                        </td>
                        <td className="border-r border-[#EEF3F8] p-3 text-center">
                          {c.contractFileUrl && (
                            <button
                              type="button"
                              className="mr-2 text-[#007EB8] hover:underline"
                              onClick={() => preview(c, "contract")}
                            >
                              Xem file
                            </button>
                          )}
                          {c.signedImageUrl && (
                            <button
                              type="button"
                              className="text-[#007EB8] hover:underline"
                              onClick={() => preview(c, "signed")}
                            >
                              Xem ảnh ký
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1.5">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  title="Sửa"
                                  onClick={() => openContract(c)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE7F4] text-[#007EB8] transition-colors hover:bg-[#E8F7FF]"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="Gia hạn"
                                  onClick={() => openExtension(c)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE7F4] text-[#118F9B] transition-colors hover:bg-[#E8F8F7]"
                                >
                                  <RefreshCw size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!contracts.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-10 text-center text-slate-500"
                      >
                        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F7FF] text-[#00A4E8]"><FileSignature size={19} /></span>
                          <span>Chưa có hợp đồng nào.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {total > limit && (
              <div className="flex items-center justify-between border-t border-[#E8EEF5] bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="relative inline-flex items-center rounded-lg border border-[#DCE7F4] bg-white px-4 py-2 text-xs text-slate-700 transition-colors hover:bg-[#F4FAFE] disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    disabled={page * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="relative ml-3 inline-flex items-center rounded-lg border border-[#DCE7F4] bg-white px-4 py-2 text-xs text-slate-700 transition-colors hover:bg-[#F4FAFE] disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-700">
                      Hiển thị từ <span className="font-medium">{(page - 1) * limit + 1}</span> đến{" "}
                      <span className="font-medium">{Math.min(page * limit, total)}</span> trong tổng số{" "}
                      <span className="font-medium">{total}</span> hợp đồng
                    </p>
                  </div>
                  <div>
                    <nav className="inline-flex items-center gap-1 rounded-xl border border-[#DCE7F4] bg-white p-1" aria-label="Pagination">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(1)}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8] disabled:opacity-30"
                      >
                        «
                      </button>
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8] disabled:opacity-30"
                      >
                        ‹
                      </button>
                      {Array.from({ length: Math.ceil(total / limit) }).map((_, idx) => {
                        const pageNum = idx + 1;
                        if (Math.abs(page - pageNum) > 2) return null;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-normal transition-colors ${
                              page === pageNum
                                ? "bg-[#E8F7FF] text-[#007EB8]"
                                : "text-slate-600 hover:bg-[#F4FAFE]"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        disabled={page * limit >= total}
                        onClick={() => setPage((p) => p + 1)}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8] disabled:opacity-30"
                      >
                        ›
                      </button>
                      <button
                        disabled={page * limit >= total}
                        onClick={() => setPage(Math.ceil(total / limit))}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8] disabled:opacity-30"
                      >
                        »
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {canManage && (
              <button
                onClick={() => openExtension()}
                className="flex items-center gap-1.5 rounded-xl border border-[#B8E8FB] bg-[#E8F7FF] px-4 py-2.5 text-xs font-medium text-[#007EB8] transition-colors hover:bg-[#DDF3FF]"
              >
                <Plus size={15} />
                Tạo gia hạn
              </button>
            )}
            <div className="overflow-x-auto rounded-2xl border border-[#DCE7F4] bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-xs text-slate-700">
                <thead className="bg-[#F1F8FC] text-slate-600">
                  <tr>
                    <th className="border-r border-[#E8EEF5] p-3 text-left font-medium">Nhân viên</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Ngày gia hạn</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Hạn cũ</th>
                    <th className="border-r border-[#E8EEF5] p-3 font-medium">Hạn mới</th>
                    <th className="border-r border-[#E8EEF5] p-3 text-left font-medium">Lý do</th>
                    <th className="p-3 font-medium">Tài liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EEF5]">
                  {extensions.map((x) => (
                    <tr key={x._id} className="transition-colors hover:bg-[#F8FCFF]">
                      <td className="border-r border-[#EEF3F8] p-3 font-medium text-slate-800">{x.employeeName}</td>
                      <td className="border-r border-[#EEF3F8] p-3 text-center">
                        {date(x.extensionDate)}
                      </td>
                      <td className="border-r border-[#EEF3F8] p-3 text-center">
                        {date(x.previousEndDate)}
                      </td>
                      <td className="border-r border-[#EEF3F8] p-3 text-center text-emerald-700">
                        {date(x.newEndDate)}
                      </td>
                      <td className="border-r border-[#EEF3F8] p-3">{x.reason || "—"}</td>
                      <td className="p-3 text-center">
                        {x.extensionFileUrl && (
                          <a
                            href={x.extensionFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mr-2 text-[#007EB8] hover:underline"
                          >
                            File
                          </a>
                        )}
                        {x.signedImageUrl && (
                          <a
                            href={x.signedImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#007EB8] hover:underline"
                          >
                            Ảnh ký
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!extensions.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-10 text-center text-slate-500"
                      >
                        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F7FF] text-[#00A4E8]"><RefreshCw size={18} /></span>
                          <span>Chưa có lịch sử gia hạn hợp đồng.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {editing && (
        <Modal
          title={editing === "new" ? "Tạo hợp đồng" : "Cập nhật hợp đồng"}
          close={() => setEditing(null)}
          save={saveContract}
          saving={saving || uploading !== null}
          valid={Boolean(
            contractForm.employeeId &&
            contractForm.contractType &&
            contractForm.startDate &&
            contractForm.endDate,
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 space-y-1.5 text-xs text-slate-600">
              Nhân viên
              <HrFormSelect
                value={contractForm.employeeId}
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    employeeId: value,
                  })
                }
                label="Nhân viên"
                options={[
                  { value: "", label: "Chọn nhân viên" },
                  ...employees.map((e) => ({ value: e._id, label: e.displayName || e.email })),
                ]}
              />
            </label>
            <label className="col-span-2 space-y-1.5 text-xs text-slate-600">
              Loại hợp đồng
              <input
                className={input}
                value={contractForm.contractType}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    contractType: e.target.value,
                  })
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-slate-600">
              Ngày bắt đầu
              <DateInput24
                ariaLabel="Ngày bắt đầu"
                value={contractForm.startDate}
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    startDate: value,
                  })
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-slate-600">
              Ngày hết hạn
              <DateInput24
                ariaLabel="Ngày hết hạn"
                value={contractForm.endDate}
                onChange={(value) =>
                  setContractForm({ ...contractForm, endDate: value })
                }
              />
            </label>
            <label className="space-y-1.5 text-xs text-slate-600">
              Trạng thái
              <HrFormSelect
                value={contractForm.status}
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    status: value as ContractStatus,
                  })
                }
                label="Trạng thái hợp đồng"
                options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))}
              />
            </label>
            <div className="text-xs text-slate-600">
              <span>File hợp đồng (PDF, DOC, DOCX)</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 bg-[#F8FCFF] font-normal text-[#007EB8] hover:bg-[#E8F7FF]`}
              >
                <Upload size={14} />
                {uploading === "contract"
                  ? "Đang tải lên..."
                  : "Chọn file hợp đồng"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadContractFile(file, "contract");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {contractForm.contractFileUrl && (
                <a
                  href={contractForm.contractFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-cyan-700"
                >
                  Đã tải file — xem tài liệu
                </a>
              )}
            </div>
            <div className="text-xs text-slate-600">
              <span>Ảnh hợp đồng đã ký</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 bg-[#F8FCFF] font-normal text-[#007EB8] hover:bg-[#E8F7FF]`}
              >
                <Upload size={14} />
                {uploading === "signed" ? "Đang tải lên..." : "Chọn ảnh đã ký"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadContractFile(file, "signed");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {contractForm.signedImageUrl && (
                <a
                  href={contractForm.signedImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-cyan-700"
                >
                  Đã tải ảnh — xem ảnh
                </a>
              )}
            </div>
            <label className="col-span-2 space-y-1.5 text-xs text-slate-600">
              Ghi chú
              <textarea
                className={input}
                value={contractForm.note}
                onChange={(e) =>
                  setContractForm({ ...contractForm, note: e.target.value })
                }
              />
            </label>
          </div>
        </Modal>
      )}
      {extOpen && (
        <Modal
          title="Gia hạn hợp đồng"
          close={() => setExtOpen(false)}
          save={saveExtension}
          saving={saving || uploading !== null}
          valid={Boolean(
            extensionForm.contractId &&
            extensionForm.newEndDate &&
            extensionForm.extensionDate,
          )}
        >
          <div className="space-y-3">
            <label className="space-y-1.5 text-xs text-slate-600">
              Hợp đồng
              <HrFormSelect
                value={extensionForm.contractId}
                onChange={(value) =>
                  setExtensionForm({
                    ...extensionForm,
                    contractId: value,
                  })
                }
                label="Hợp đồng"
                options={[
                  { value: "", label: "Chọn hợp đồng" },
                  ...contracts
                    .filter((c) => c.status !== "terminated")
                    .map((c) => ({
                      value: c._id,
                      label: `${c.employeeName} — ${c.contractType} — hạn ${date(c.endDate)}`,
                    })),
                ]}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs text-slate-600">
                Ngày gia hạn
                <DateInput24
                  ariaLabel="Ngày gia hạn"
                  value={extensionForm.extensionDate}
                  onChange={(value) =>
                    setExtensionForm({
                      ...extensionForm,
                      extensionDate: value,
                    })
                  }
                />
              </label>
              <label className="space-y-1.5 text-xs text-slate-600">
                Ngày hết hạn mới
                <DateInput24
                  ariaLabel="Ngày hết hạn mới"
                  value={extensionForm.newEndDate}
                  onChange={(value) =>
                    setExtensionForm({
                      ...extensionForm,
                      newEndDate: value,
                    })
                  }
                />
              </label>
            </div>
            <label className="space-y-1.5 text-xs text-slate-600">
              Lý do
              <textarea
                className={input}
                value={extensionForm.reason}
                onChange={(e) =>
                  setExtensionForm({ ...extensionForm, reason: e.target.value })
                }
              />
            </label>
            <div className="text-xs text-slate-600">
              <span>File phụ lục/gia hạn (PDF, DOC, DOCX)</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 bg-[#F8FCFF] font-normal text-[#007EB8] hover:bg-[#E8F7FF]`}
              >
                <Upload size={14} />
                {uploading === "extension"
                  ? "Đang tải lên..."
                  : "Chọn file gia hạn"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadExtensionFile(file, "extension");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {extensionForm.extensionFileUrl && (
                <span className="mt-1 block truncate text-emerald-700">
                  Đã tải: {extensionForm.extensionFileName}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600">
              <span>Ảnh phụ lục đã ký</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 bg-[#F8FCFF] font-normal text-[#007EB8] hover:bg-[#E8F7FF]`}
              >
                <Upload size={14} />
                {uploading === "extensionSigned"
                  ? "Đang tải lên..."
                  : "Chọn ảnh đã ký"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadExtensionFile(file, "extensionSigned");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {extensionForm.signedImageUrl && (
                <span className="mt-1 block truncate text-emerald-700">
                  Đã tải: {extensionForm.signedImageName}
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}
      <FilePreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        hideShare
      />
    </div>
  );
}

function Modal({
  title,
  children,
  close,
  save,
  saving,
  valid,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  save: () => void;
  saving: boolean;
  valid: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="contract-modal-title" className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white text-slate-800 shadow-[0_20px_60px_rgba(15,45,75,0.2)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#E8EEF5] bg-[#F8FBFF] px-5 py-4">
          <h3 id="contract-modal-title" className="text-base font-medium text-slate-800">{title}</h3>
          <button type="button" aria-label="Đóng" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition-colors hover:bg-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E8EEF5] bg-white px-5 py-4">
          <button type="button" onClick={close} className="rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 text-xs text-slate-600 transition-colors hover:bg-[#F4FAFE]">
            Hủy
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={save}
            className="rounded-xl bg-[#00A4E8] px-4 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#008FCB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
