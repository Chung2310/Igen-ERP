import React, { useEffect, useMemo, useState } from "react";
import {
  FileSignature,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { FilePreviewModal } from "../resource/FilePreviewModal";
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
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
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
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
};
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15";
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
  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/v1/hr-contracts${suffix}`, { headers: headers() }),
        fetch(`/api/v1/hr-contracts/extensions/list${suffix}`, {
          headers: headers(),
        }),
      ]);
      const ar = await a.json();
      const br = await b.json();
      if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
      setContracts(ar.data?.contracts || []);
      setEmployees(ar.data?.employees || []);
      setExtensions(br.data || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu hợp đồng."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [companyCode, branchId]);
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
            signedImageUrl: contract.signedImageUrl || "",
            signedImageName: contract.signedImageName || "",
            signedImageMimeType: contract.signedImageMimeType || "",
            signedImageSize: contract.signedImageSize || 0,
            signedImageResourceId: contract.signedImageResourceId || "",
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
      const resource = data.data?.resource;
      setContractForm((current) =>
        target === "signed"
          ? {
              ...current,
              signedImageUrl: data.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: resource?._id || "",
            }
          : {
              ...current,
              contractFileUrl: data.data.url,
              contractFileName: file.name,
              contractFileMimeType: file.type,
              contractFileSize: file.size,
              contractResourceId: resource?._id || "",
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
      const resource = result.data?.resource;
      setExtensionForm((current) =>
        isSigned
          ? {
              ...current,
              signedImageUrl: result.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: resource?._id || "",
            }
          : {
              ...current,
              extensionFileUrl: result.data.url,
              extensionFileName: file.name,
              extensionFileMimeType: file.type,
              extensionFileSize: file.size,
              extensionResourceId: resource?._id || "",
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
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5 text-left">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileSignature className="text-cyan-600" />
              Quản lý hợp đồng
            </h2>
            <p className="text-xs text-slate-500">
              Theo dõi hợp đồng và lịch sử gia hạn của từng nhân viên.
            </p>
          </div>
          {canManage && tab === "contracts" && (
            <button
              onClick={() => openContract()}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white"
            >
              <Plus size={15} />
              Tạo hợp đồng
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-xl border bg-white p-1 w-fit">
          <button
            onClick={() => setTab("contracts")}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === "contracts" ? "bg-cyan-600 text-white" : "text-slate-600"}`}
          >
            Danh sách hợp đồng
          </button>
          <button
            onClick={() => setTab("extensions")}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === "extensions" ? "bg-cyan-600 text-white" : "text-slate-600"}`}
          >
            Gia hạn hợp đồng
          </button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Đang tải hợp đồng...
          </div>
        ) : tab === "contracts" ? (
          <>
            {expiringContracts.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <p className="text-xs font-bold">
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
                className="absolute left-3 top-2.5 text-slate-400"
                size={15}
              />
              <input
                className={input + " pl-9"}
                placeholder="Tìm nhân viên, email, phòng ban..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Nhân viên</th>
                    <th className="p-3 text-left">Loại hợp đồng</th>
                    <th className="p-3">Bắt đầu</th>
                    <th className="p-3">Hết hạn</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Tài liệu</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleEmployees.flatMap((emp) => {
                    const rows = contractsByEmployee.get(emp._id) || [];
                    if (!rows.length)
                      return [
                        <tr key={emp._id}>
                          <td className="p-3">
                            <b>{emp.displayName || emp.email}</b>
                            <div className="text-[10px] text-slate-400">
                              {emp.department}
                            </div>
                          </td>
                          <td colSpan={5} className="p-3 text-amber-600">
                            Nhân viên chưa có hợp đồng
                          </td>
                          <td className="p-3">
                            {canManage && (
                              <button
                                onClick={() => {
                                  openContract();
                                  setContractForm({
                                    ...emptyContract,
                                    employeeId: emp._id,
                                  });
                                }}
                                className="text-cyan-700 font-bold"
                              >
                                Tạo ngay
                              </button>
                            )}
                          </td>
                        </tr>,
                      ];
                    return rows.map((c, i) => {
                      const remainingDays = daysUntilExpiry(c.endDate);
                      const expiringSoon = isExpiringSoon(c);
                      return (
                        <tr
                          key={c._id}
                          className={expiringSoon ? "bg-amber-50/60" : ""}
                        >
                          <td className="p-3">
                            <b>{emp.displayName || emp.email}</b>
                            {i === 0 && (
                              <div className="text-[10px] text-slate-400">
                                {emp.department}
                              </div>
                            )}
                          </td>
                          <td className="p-3">{c.contractType}</td>
                          <td className="p-3 text-center">
                            {date(c.startDate)}
                          </td>
                          <td className="p-3 text-center">
                            <div>{date(c.endDate)}</div>
                            {expiringSoon && (
                              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                Sắp hết hạn · Còn {remainingDays} ngày
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`rounded-full px-2 py-1 font-bold ${statusStyle[c.status]}`}
                            >
                              {statusLabel[c.status]}
                            </span>
                          </td>
                          <td className="p-3 text-center space-x-2">
                            {c.contractFileUrl && (
                              <button
                                type="button"
                                className="font-bold text-cyan-700 hover:underline"
                                onClick={() => preview(c, "contract")}
                              >
                                Xem file
                              </button>
                            )}
                            {c.signedImageUrl && (
                              <button
                                type="button"
                                className="font-bold text-cyan-700 hover:underline"
                                onClick={() => preview(c, "signed")}
                              >
                                Xem ảnh ký
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {canManage && (
                                <>
                                  <button
                                    title="Sửa"
                                    onClick={() => openContract(c)}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    title="Gia hạn"
                                    onClick={() => openExtension(c)}
                                  >
                                    <RefreshCw size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {canManage && (
              <button
                onClick={() => openExtension()}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white"
              >
                <Plus size={15} />
                Tạo gia hạn
              </button>
            )}
            <div className="overflow-hidden rounded-2xl border bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Nhân viên</th>
                    <th className="p-3">Ngày gia hạn</th>
                    <th className="p-3">Hạn cũ</th>
                    <th className="p-3">Hạn mới</th>
                    <th className="p-3 text-left">Lý do</th>
                    <th className="p-3">Tài liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {extensions.map((x) => (
                    <tr key={x._id}>
                      <td className="p-3 font-bold">{x.employeeName}</td>
                      <td className="p-3 text-center">
                        {date(x.extensionDate)}
                      </td>
                      <td className="p-3 text-center">
                        {date(x.previousEndDate)}
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-700">
                        {date(x.newEndDate)}
                      </td>
                      <td className="p-3">{x.reason || "—"}</td>
                      <td className="p-3 text-center space-x-2">
                        {x.extensionFileUrl && (
                          <a
                            href={x.extensionFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-700"
                          >
                            File
                          </a>
                        )}
                        {x.signedImageUrl && (
                          <a
                            href={x.signedImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-700"
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
                        className="p-10 text-center text-slate-400"
                      >
                        Chưa có lịch sử gia hạn hợp đồng.
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
            <label className="col-span-2 text-xs">
              Nhân viên
              <select
                className={input}
                value={contractForm.employeeId}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">Chọn nhân viên</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.displayName || e.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs">
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
            <label className="text-xs">
              Ngày bắt đầu
              <input
                type="date"
                className={input}
                value={contractForm.startDate}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    startDate: e.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs">
              Ngày hết hạn
              <input
                type="date"
                className={input}
                value={contractForm.endDate}
                onChange={(e) =>
                  setContractForm({ ...contractForm, endDate: e.target.value })
                }
              />
            </label>
            <label className="text-xs">
              Trạng thái
              <select
                className={input}
                value={contractForm.status}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    status: e.target.value as ContractStatus,
                  })
                }
              >
                {Object.entries(statusLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs">
              <span>File hợp đồng (PDF, DOC, DOCX)</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 font-bold text-cyan-700`}
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
            <div className="text-xs">
              <span>Ảnh hợp đồng đã ký</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 font-bold text-cyan-700`}
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
            <label className="col-span-2 text-xs">
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
            <label className="text-xs">
              Hợp đồng
              <select
                className={input}
                value={extensionForm.contractId}
                onChange={(e) =>
                  setExtensionForm({
                    ...extensionForm,
                    contractId: e.target.value,
                  })
                }
              >
                <option value="">Chọn hợp đồng</option>
                {contracts
                  .filter((c) => c.status !== "terminated")
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.employeeName} — {c.contractType} — hạn{" "}
                      {date(c.endDate)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                Ngày gia hạn
                <input
                  type="date"
                  className={input}
                  value={extensionForm.extensionDate}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      extensionDate: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs">
                Ngày hết hạn mới
                <input
                  type="date"
                  className={input}
                  value={extensionForm.newEndDate}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      newEndDate: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label className="text-xs">
              Lý do
              <textarea
                className={input}
                value={extensionForm.reason}
                onChange={(e) =>
                  setExtensionForm({ ...extensionForm, reason: e.target.value })
                }
              />
            </label>
            <div className="text-xs">
              <span>File phụ lục/gia hạn (PDF, DOC, DOCX)</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 font-bold text-cyan-700`}
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
            <div className="text-xs">
              <span>Ảnh phụ lục đã ký</span>
              <label
                className={`${input} mt-1 flex cursor-pointer items-center justify-center gap-2 font-bold text-cyan-700`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <h3 className="mb-4 font-bold text-slate-900">{title}</h3>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={close} className="px-4 py-2 text-xs">
            Hủy
          </button>
          <button
            disabled={!valid || saving}
            onClick={save}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
