import { getContractFiles, getSignedImages, getExtensionFiles, getExtensionSignedImages } from "../../services/hrContractFiles";
import type { ContractStatus, ContractFileItem, Contract, Employee, Extension } from "../../types/hrContract";
export type { ContractFileItem } from "../../types/hrContract";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileSignature,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  Eye,
  Trash2,
  FileText,
  Image as ImageIcon,
  Loader2,
  FileCheck2,
  Download,
  X,
} from "lucide-react";

import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { FilePreviewModal } from "../resource/FilePreviewModal";
import type { ResourceItem } from "../../types";

const DocxPreview = React.lazy(() => import("../resource/DocxPreview").then((m) => ({ default: m.DocxPreview })));

export type ContractPreviewData = {
  title: string;
  subtitle?: string;
  contractFiles: ContractFileItem[];
  signedImages: ContractFileItem[];
  initialTab?: "contract" | "signed";
  initialFileIndex?: number;
};

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAccessToken()}`,
});

const date = (value?: string) => (value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—");
const isoDate = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const mimeFromName = (name: string) => {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "doc") return "application/msword";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || ""))
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
  return "";
};
const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const daysUntilExpiry = (value: string, now = new Date()) => {
  const expiry = new Date(value);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.ceil((expiryUtc - todayUtc) / 86_400_000);
};
const isExpiringSoon = (contract: Contract) => {
  const remaining = daysUntilExpiry(contract.endDate);
  return contract.status === "active" && remaining >= 0 && remaining <= 20;
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
  contractFiles: [] as ContractFileItem[],
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  signedImages: [] as ContractFileItem[],
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
  extensionFiles: [] as ContractFileItem[],
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  signedImages: [] as ContractFileItem[],
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
  const [allExpiringContracts, setAllExpiringContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [extensionPage, setExtensionPage] = useState(1);
  const [extensionTotal, setExtensionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [extOpen, setExtOpen] = useState(false);
  const [extensionForm, setExtensionForm] = useState(emptyExtension);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"contract" | "signed" | "extension" | "extensionSigned" | null>(null);
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);
  const [contractPreviewData, setContractPreviewData] = useState<ContractPreviewData | null>(null);
  const suffix = `?companyCode=${encodeURIComponent(companyCode)}${branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""}`;
  const load = useCallback(
    async (currentPage = page, currentSearch = debouncedSearch) => {
      setLoading(true);
      try {
        const contractSuffix = `${suffix}&page=${currentPage}&limit=${limit}${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""}`;
        const [a, b] = await Promise.all([
          fetch(`/api/v1/hr-contracts${contractSuffix}`, { headers: headers() }),
          fetch(`/api/v1/hr-contracts/extensions/list${suffix}&page=${extensionPage}&limit=${limit}`, {
            headers: headers(),
          }),
        ]);
        const ar = await a.json();
        const br = await b.json();
        if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
        setContracts(ar.data?.contracts || []);
        setEmployees(ar.data?.employees || []);
        setTotal(ar.data?.total || 0);
        if (Array.isArray(ar.data?.expiringContracts)) {
          setAllExpiringContracts(ar.data.expiringContracts);
        } else {
          setAllExpiringContracts((prev) => (prev.length ? prev : (ar.data?.contracts || []).filter(isExpiringSoon)));
        }
        setExtensions(br.data || []);
        setExtensionTotal(br.pagination?.total || 0);
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu hợp đồng."));
      } finally {
        setLoading(false);
      }
    },
    [suffix, page, limit, debouncedSearch, extensionPage],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const contractSuffix = `${suffix}&page=${page}&limit=${limit}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`;
        const [a, b] = await Promise.all([
          fetch(`/api/v1/hr-contracts${contractSuffix}`, { headers: headers() }),
          fetch(`/api/v1/hr-contracts/extensions/list${suffix}&page=${extensionPage}&limit=${limit}`, {
            headers: headers(),
          }),
        ]);
        const ar = await a.json();
        const br = await b.json();
        if (cancelled) return;
        if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
        setContracts(ar.data?.contracts || []);
        setEmployees(ar.data?.employees || []);
        setTotal(ar.data?.total || 0);
        if (Array.isArray(ar.data?.expiringContracts)) {
          setAllExpiringContracts(ar.data.expiringContracts);
        } else {
          setAllExpiringContracts((prev) => (prev.length ? prev : (ar.data?.contracts || []).filter(isExpiringSoon)));
        }
        setExtensions(br.data || []);
        setExtensionTotal(br.pagination?.total || 0);
      } catch (e) {
        if (!cancelled) toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu hợp đồng."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suffix, page, limit, debouncedSearch, extensionPage]);
  const contractsByEmployee = useMemo(
    () => new Map(employees.map((e) => [e._id, contracts.filter((c) => c.employeeId === e._id)])),
    [employees, contracts],
  );
  const expiringContracts = useMemo(
    () =>
      [...allExpiringContracts]
        .filter(isExpiringSoon)
        .sort((a, b) => daysUntilExpiry(a.endDate) - daysUntilExpiry(b.endDate)),
    [allExpiringContracts],
  );
  const visibleEmployees = employees.filter((e) =>
    `${e.displayName || ""} ${e.email} ${e.department || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const openContract = (contract?: Contract) => {
    setEditing(contract || "new");
    if (!contract) {
      setContractForm(emptyContract);
      return;
    }
    const contractFiles = getContractFiles(contract);
    const signedImages = getSignedImages(contract);
    setContractForm({
      contractType: contract.contractType,
      employeeId: contract.employeeId,
      startDate: isoDate(contract.startDate),
      endDate: isoDate(contract.endDate),
      status: contract.status,
      contractFileUrl: contractFiles[0]?.url || "",
      contractFileName: contractFiles[0]?.name || "",
      contractFileMimeType: contractFiles[0]?.mimeType || "",
      contractFileSize: contractFiles[0]?.size || 0,
      contractResourceId: contractFiles[0]?.resourceId || "",
      contractFiles,
      signedImageUrl: signedImages[0]?.url || "",
      signedImageName: signedImages[0]?.name || "",
      signedImageMimeType: signedImages[0]?.mimeType || "",
      signedImageSize: signedImages[0]?.size || 0,
      signedImageResourceId: signedImages[0]?.resourceId || "",
      signedImages,
      note: contract.note || "",
    });
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

  const openExtension = (contract?: Contract, ext?: Extension) => {
    const extensionFiles = ext ? getExtensionFiles(ext) : [];
    const signedImages = ext ? getExtensionSignedImages(ext) : [];
    setExtensionForm({
      contractId: contract?._id || ext?.contractId || "",
      newEndDate: contract ? isoDate(contract.endDate) : ext ? isoDate(ext.newEndDate) : "",
      extensionDate: ext ? isoDate(ext.extensionDate) : new Date().toISOString().slice(0, 10),
      reason: ext?.reason || "",
      extensionFileUrl: extensionFiles[0]?.url || "",
      extensionFileName: extensionFiles[0]?.name || "",
      extensionFileMimeType: extensionFiles[0]?.mimeType || "",
      extensionFileSize: extensionFiles[0]?.size || 0,
      extensionResourceId: extensionFiles[0]?.resourceId || "",
      extensionFiles,
      signedImageUrl: signedImages[0]?.url || "",
      signedImageName: signedImages[0]?.name || "",
      signedImageMimeType: signedImages[0]?.mimeType || "",
      signedImageSize: signedImages[0]?.size || 0,
      signedImageResourceId: signedImages[0]?.resourceId || "",
      signedImages,
    });
    setExtOpen(true);
    setTab("extensions");
  };

  const saveExtension = async () => {
    setSaving(true);
    try {
      const { contractId, ...body } = extensionForm;
      const res = await fetch(`/api/v1/hr-contracts/${contractId}/extensions${suffix}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
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

  const uploadBatchFiles = async (
    files: File[],
    target: "contract" | "signed" | "extension" | "extensionSigned",
  ) => {
    if (!files.length) return;
    const isSigned = target === "signed" || target === "extensionSigned";

    const validFiles: File[] = [];
    for (const file of files) {
      const allowed = isSigned
        ? file.type.startsWith("image/")
        : [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type) || /\.(pdf|doc|docx)$/i.test(file.name);

      if (!allowed) {
        toast.error(
          isSigned
            ? `Tệp "${file.name}" không phải là ảnh hợp lệ.`
            : `Tệp "${file.name}" không hợp lệ. Chỉ hỗ trợ PDF, DOC hoặc DOCX.`,
        );
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Tệp "${file.name}" vượt quá giới hạn 10 MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;
    setUploading(target);

    try {
      const uploadSingle = async (file: File): Promise<ContractFileItem> => {
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
            mimeType: file.type || mimeFromName(file.name),
            size: file.size,
            kind: target,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Tải tệp ${file.name} thất bại.`);
        return {
          url: data.data.url,
          name: file.name,
          mimeType: file.type || mimeFromName(file.name),
          size: file.size,
          resourceId: data.data?.resource?._id || "",
          uploadToken: data.data.uploadToken,
        };
      };

      const uploaded = await Promise.all(validFiles.map(uploadSingle));

      if (target === "contract") {
        setContractForm((current) => {
          const contractFiles = [...current.contractFiles, ...uploaded];
          return {
            ...current,
            contractFiles,
            contractFileUrl: contractFiles[0]?.url || "",
            contractFileName: contractFiles[0]?.name || "",
            contractFileMimeType: contractFiles[0]?.mimeType || "",
            contractFileSize: contractFiles[0]?.size || 0,
            contractResourceId: contractFiles[0]?.resourceId || "",
          };
        });
      } else if (target === "signed") {
        setContractForm((current) => {
          const signedImages = [...current.signedImages, ...uploaded];
          return {
            ...current,
            signedImages,
            signedImageUrl: signedImages[0]?.url || "",
            signedImageName: signedImages[0]?.name || "",
            signedImageMimeType: signedImages[0]?.mimeType || "",
            signedImageSize: signedImages[0]?.size || 0,
            signedImageResourceId: signedImages[0]?.resourceId || "",
          };
        });
      } else if (target === "extension") {
        setExtensionForm((current) => {
          const extensionFiles = [...current.extensionFiles, ...uploaded];
          return {
            ...current,
            extensionFiles,
            extensionFileUrl: extensionFiles[0]?.url || "",
            extensionFileName: extensionFiles[0]?.name || "",
            extensionFileMimeType: extensionFiles[0]?.mimeType || "",
            extensionFileSize: extensionFiles[0]?.size || 0,
            extensionResourceId: extensionFiles[0]?.resourceId || "",
          };
        });
      } else if (target === "extensionSigned") {
        setExtensionForm((current) => {
          const signedImages = [...current.signedImages, ...uploaded];
          return {
            ...current,
            signedImages,
            signedImageUrl: signedImages[0]?.url || "",
            signedImageName: signedImages[0]?.name || "",
            signedImageMimeType: signedImages[0]?.mimeType || "",
            signedImageSize: signedImages[0]?.size || 0,
            signedImageResourceId: signedImages[0]?.resourceId || "",
          };
        });
      }
      toast.success(`Đã tải lên ${uploaded.length} tệp thành công.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Có lỗi xảy ra khi tải tệp."));
    } finally {
      setUploading(null);
    }
  };

  const removeContractFile = (index: number) => {
    setContractForm((current) => {
      const contractFiles = current.contractFiles.filter((_, i) => i !== index);
      return {
        ...current,
        contractFiles,
        contractFileUrl: contractFiles[0]?.url || "",
        contractFileName: contractFiles[0]?.name || "",
        contractFileMimeType: contractFiles[0]?.mimeType || "",
        contractFileSize: contractFiles[0]?.size || 0,
        contractResourceId: contractFiles[0]?.resourceId || "",
      };
    });
  };

  const removeContractSignedImage = (index: number) => {
    setContractForm((current) => {
      const signedImages = current.signedImages.filter((_, i) => i !== index);
      return {
        ...current,
        signedImages,
        signedImageUrl: signedImages[0]?.url || "",
        signedImageName: signedImages[0]?.name || "",
        signedImageMimeType: signedImages[0]?.mimeType || "",
        signedImageSize: signedImages[0]?.size || 0,
        signedImageResourceId: signedImages[0]?.resourceId || "",
      };
    });
  };

  const removeExtensionFile = (index: number) => {
    setExtensionForm((current) => {
      const extensionFiles = current.extensionFiles.filter((_, i) => i !== index);
      return {
        ...current,
        extensionFiles,
        extensionFileUrl: extensionFiles[0]?.url || "",
        extensionFileName: extensionFiles[0]?.name || "",
        extensionFileMimeType: extensionFiles[0]?.mimeType || "",
        extensionFileSize: extensionFiles[0]?.size || 0,
        extensionResourceId: extensionFiles[0]?.resourceId || "",
      };
    });
  };

  const removeExtensionSignedImage = (index: number) => {
    setExtensionForm((current) => {
      const signedImages = current.signedImages.filter((_, i) => i !== index);
      return {
        ...current,
        signedImages,
        signedImageUrl: signedImages[0]?.url || "",
        signedImageName: signedImages[0]?.name || "",
        signedImageMimeType: signedImages[0]?.mimeType || "",
        signedImageSize: signedImages[0]?.size || 0,
        signedImageResourceId: signedImages[0]?.resourceId || "",
      };
    });
  };

  const previewFile = (file: ContractFileItem) => {
    setPreviewItem({
      _id: file.resourceId || `preview-${Date.now()}`,
      companyCode,
      section: "local",
      type: "file",
      name: file.name,
      parentId: null,
      fileUrl: file.url,
      mimeType: file.mimeType || mimeFromName(file.name),
      size: file.size,
      createdAt: "",
      updatedAt: "",
    });
  };

  const openContractPreviewModal = (contract: Contract, targetTab?: "contract" | "signed", targetIndex = 0) => {
    const cFiles = getContractFiles(contract);
    const sImages = getSignedImages(contract);
    const defaultTab = targetTab || (cFiles.length > 0 ? "contract" : "signed");
    setContractPreviewData({
      title: `Hợp đồng · ${contract.employeeName}`,
      subtitle: `${contract.contractType} · Hiệu lực: ${date(contract.startDate)} — ${date(contract.endDate)}`,
      contractFiles: cFiles,
      signedImages: sImages,
      initialTab: defaultTab,
      initialFileIndex: targetIndex,
    });
  };

  const openExtensionPreviewModal = (ext: Extension, targetTab?: "contract" | "signed", targetIndex = 0) => {
    const extFiles = getExtensionFiles(ext);
    const sImages = getExtensionSignedImages(ext);
    const defaultTab = targetTab || (extFiles.length > 0 ? "contract" : "signed");
    setContractPreviewData({
      title: `Phụ lục gia hạn · ${ext.employeeName}`,
      subtitle: `Gia hạn đến ${date(ext.newEndDate)} · Ngày lập: ${date(ext.extensionDate)}`,
      contractFiles: extFiles,
      signedImages: sImages,
      initialTab: defaultTab,
      initialFileIndex: targetIndex,
    });
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5 text-left">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="hr-tab-header flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileSignature className="text-cyan-600" />
              Quản lý hợp đồng
            </h2>
            <p className="text-xs text-slate-500">Theo dõi hợp đồng và lịch sử gia hạn của từng nhân viên.</p>
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
          <div className="p-12 text-center text-xs text-slate-500">Đang tải hợp đồng...</div>
        ) : tab === "contracts" ? (
          <>
            {expiringContracts.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    Có {expiringContracts.length} hợp đồng sắp hết hạn trong 20 ngày tới
                  </p>
                  <span className="text-[11px] text-amber-700">
                    Bấm vào nhân viên để lọc danh sách
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {expiringContracts.map((contract) => {
                    const remaining = daysUntilExpiry(contract.endDate);
                    return (
                      <button
                        type="button"
                        key={contract._id}
                        onClick={() => setSearch(contract.employeeName || "")}
                        title={`Bấm để tìm hợp đồng của ${contract.employeeName}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer text-left"
                      >
                        <span>{contract.employeeName}</span>
                        <span className="text-[10px] text-amber-600 font-normal">({date(contract.endDate)})</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            remaining <= 3 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {remaining <= 0 ? "Hôm nay" : `Còn ${remaining} ngày`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                className={input + " pl-9 pr-8"}
                placeholder="Tìm nhân viên, email, phòng ban..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xoá tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Mobile card list */}
            <div className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white md:hidden">
              {visibleEmployees.flatMap((emp) => {
                const rows = contractsByEmployee.get(emp._id) || [];
                if (!rows.length) {
                  return [
                    <div key={emp._id} className="flex flex-col gap-2 p-4 text-xs">
                      <div>
                        <b>{emp.displayName || emp.email}</b>
                        <div className="text-[10px] text-slate-400">{emp.department}</div>
                      </div>
                      <div className="text-amber-600">Nhân viên chưa có hợp đồng</div>
                      {canManage && (
                        <button
                          onClick={() => {
                            openContract();
                            setContractForm({ ...emptyContract, employeeId: emp._id });
                          }}
                          className="w-fit font-bold text-cyan-700"
                        >
                          Tạo ngay
                        </button>
                      )}
                    </div>,
                  ];
                }
                return rows.map((c) => {
                  const remainingDays = daysUntilExpiry(c.endDate);
                  const expiringSoon = isExpiringSoon(c);
                  return (
                    <div
                      key={c._id}
                      className={`flex flex-col gap-2 p-4 text-xs ${expiringSoon ? "bg-amber-50/60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <b>{emp.displayName || emp.email}</b>
                          <div className="text-[10px] text-slate-400">{emp.department}</div>
                        </div>
                        <span className={`rounded-full px-2 py-1 font-bold ${statusStyle[c.status]}`}>
                          {statusLabel[c.status]}
                        </span>
                      </div>

                      <div className="text-slate-600">{c.contractType}</div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                        <span>Bắt đầu: {date(c.startDate)}</span>
                        <span>Hết hạn: {date(c.endDate)}</span>
                      </div>
                      {expiringSoon && (
                        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Sắp hết hạn · Còn {remainingDays} ngày
                        </span>
                      )}

                      {(() => {
                        const cFiles = getContractFiles(c);
                        const sImages = getSignedImages(c);
                        const totalCount = cFiles.length + sImages.length;
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            {totalCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openContractPreviewModal(c)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50/70 hover:text-cyan-800 shadow-2xs transition group cursor-pointer"
                                title={`Xem tài liệu: ${cFiles.length} tệp hợp đồng, ${sImages.length} ảnh đã ký`}
                              >
                                <Eye size={14} className="text-cyan-600 group-hover:scale-110 transition-transform" />
                                <span>Xem tài liệu</span>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-800">
                                  {totalCount}
                                </span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chưa có tài liệu</span>
                            )}
                            {canManage && (
                              <div className="flex items-center gap-2 ml-auto pt-1 sm:pt-0">
                                <button
                                  title="Sửa"
                                  className="flex items-center gap-1 text-slate-600 hover:text-cyan-700"
                                  onClick={() => openContract(c)}
                                >
                                  <Pencil size={14} /> Sửa
                                </button>
                                <button
                                  title="Gia hạn"
                                  className="flex items-center gap-1 text-slate-600 hover:text-cyan-700"
                                  onClick={() => openExtension(c)}
                                >
                                  <RefreshCw size={14} /> Gia hạn
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                });
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full text-xs [&_td]:align-middle [&_th]:align-middle">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wide">
                  <tr>
                    <th className="px-4 py-3.5 text-left w-[20%]">Nhân viên</th>
                    <th className="px-4 py-3.5 text-left w-[18%]">Loại hợp đồng</th>
                    <th className="px-4 py-3.5 text-center w-[12%]">Bắt đầu</th>
                    <th className="px-4 py-3.5 text-center w-[18%]">Hết hạn</th>
                    <th className="px-4 py-3.5 text-center w-[14%]">Trạng thái</th>
                    <th className="px-4 py-3.5 text-center w-[10%]">Tài liệu</th>
                    <th className="px-4 py-3.5 text-center w-[8%]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleEmployees.flatMap((emp) => {
                    const rows = contractsByEmployee.get(emp._id) || [];
                    if (!rows.length)
                      return [
                        <tr key={emp._id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3.5 text-left">
                            <b className="text-slate-900">{emp.displayName || emp.email}</b>
                            <div className="text-[11px] text-slate-400">{emp.department || "Chưa cập nhật phòng ban"}</div>
                          </td>
                          <td colSpan={5} className="px-4 py-3.5 text-left text-amber-600 italic font-medium">
                            Nhân viên chưa có hợp đồng
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  openContract();
                                  setContractForm({
                                    ...emptyContract,
                                    employeeId: emp._id,
                                  });
                                }}
                                className="inline-flex items-center justify-center px-3 py-1 bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 rounded-lg font-bold text-xs transition cursor-pointer"
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
                        <tr key={c._id} className={`hover:bg-slate-50/50 transition ${expiringSoon ? "bg-amber-50/60" : ""}`}>
                          <td className="px-4 py-3.5 text-left">
                            <b className="text-slate-900">{emp.displayName || emp.email}</b>
                            {i === 0 && <div className="text-[11px] text-slate-400">{emp.department}</div>}
                          </td>
                          <td className="px-4 py-3.5 text-left font-medium text-slate-700">{c.contractType || "—"}</td>
                          <td className="px-4 py-3.5 text-center font-medium text-slate-600">{date(c.startDate)}</td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="font-medium text-slate-800">{date(c.endDate)}</div>
                            {expiringSoon && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                Sắp hết hạn · Còn {remainingDays} ngày
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[c.status]}`}>
                              {statusLabel[c.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {(() => {
                              const cFiles = getContractFiles(c);
                              const sImages = getSignedImages(c);
                              const totalCount = cFiles.length + sImages.length;
                              if (totalCount === 0) {
                                return <span className="text-slate-300 font-medium">—</span>;
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => openContractPreviewModal(c)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50/70 hover:text-cyan-800 shadow-2xs transition group cursor-pointer"
                                  title={`Xem tài liệu: ${cFiles.length} tệp hợp đồng, ${sImages.length} ảnh đã ký`}
                                >
                                  <Eye size={14} className="text-cyan-600 group-hover:scale-110 transition-transform" />
                                  <span>Xem</span>
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-800">
                                    {totalCount}
                                  </span>
                                </button>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5 text-slate-500">
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    title="Sửa hợp đồng"
                                    onClick={() => openContract(c)}
                                    className="p-1.5 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Gia hạn hợp đồng"
                                    onClick={() => openExtension(c)}
                                    className="p-1.5 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
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

            {total > limit && (
              <nav
                aria-label="Phân trang hợp đồng"
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="text-xs text-slate-500">
                  Trang {page}/{Math.ceil(total / limit)} · {total} hợp đồng
                </span>
                <button
                  type="button"
                  disabled={page * limit >= total}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  Sau
                </button>
              </nav>
            )}
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
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <table className="w-full text-xs [&_td]:align-middle [&_th]:align-middle">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wide">
                  <tr>
                    <th className="px-4 py-3.5 text-left w-[22%]">Nhân viên</th>
                    <th className="px-4 py-3.5 text-center w-[14%]">Ngày gia hạn</th>
                    <th className="px-4 py-3.5 text-center w-[14%]">Hạn cũ</th>
                    <th className="px-4 py-3.5 text-center w-[14%]">Hạn mới</th>
                    <th className="px-4 py-3.5 text-left w-[24%]">Lý do</th>
                    <th className="px-4 py-3.5 text-center w-[12%]">Tài liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extensions.map((x) => (
                    <tr key={x._id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3.5 text-left font-bold text-slate-900">{x.employeeName}</td>
                      <td className="px-4 py-3.5 text-center font-medium text-slate-600">{date(x.extensionDate)}</td>
                      <td className="px-4 py-3.5 text-center font-medium text-slate-600">{date(x.previousEndDate)}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-emerald-700">{date(x.newEndDate)}</td>
                      <td className="px-4 py-3.5 text-left text-slate-600">{x.reason || "—"}</td>
                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const extFiles = getExtensionFiles(x);
                          const sImages = getExtensionSignedImages(x);
                          const totalCount = extFiles.length + sImages.length;
                          if (totalCount === 0) {
                            return <span className="text-slate-300 font-medium">—</span>;
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => openExtensionPreviewModal(x)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50/70 hover:text-cyan-800 shadow-2xs transition group cursor-pointer"
                              title={`Xem tài liệu: ${extFiles.length} tệp gia hạn, ${sImages.length} ảnh đã ký`}
                            >
                              <Eye size={14} className="text-cyan-600 group-hover:scale-110 transition-transform" />
                              <span>Xem</span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-800">
                                {totalCount}
                              </span>
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}

                  {!extensions.length && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400">
                        Chưa có lịch sử gia hạn hợp đồng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {extensionTotal > limit && (
              <nav aria-label="Phân trang gia hạn hợp đồng" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <button type="button" disabled={extensionPage === 1} onClick={() => setExtensionPage((current) => Math.max(current - 1, 1))} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Trước</button>
                <span className="text-xs text-slate-500">Trang {extensionPage}/{Math.ceil(extensionTotal / limit)} · {extensionTotal} gia hạn</span>
                <button type="button" disabled={extensionPage * limit >= extensionTotal} onClick={() => setExtensionPage((current) => current + 1)} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Sau</button>
              </nav>
            )}
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
            contractForm.employeeId && contractForm.contractType && contractForm.startDate && contractForm.endDate,
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
                onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
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
            {/* Drag & Drop: Contract Document Files */}
            <div className="col-span-2">
              <DropzoneUpload
                label="File tài liệu hợp đồng (PDF, DOC, DOCX)"
                acceptNotice="Kéo thả hoặc chọn nhiều tệp cùng lúc (PDF, DOC, DOCX) · Tối đa 10 MB/tệp"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                files={contractForm.contractFiles}
                uploading={uploading === "contract"}
                onFilesSelected={(files) => void uploadBatchFiles(files, "contract")}
                onRemove={removeContractFile}
                onPreview={previewFile}
              />
            </div>

            {/* Drag & Drop: Signed Images */}
            <div className="col-span-2">
              <DropzoneUpload
                label="Ảnh hợp đồng đã ký"
                acceptNotice="Kéo thả hoặc chọn nhiều ảnh đã ký (JPG, PNG, WEBP, GIF) · Tối đa 10 MB/ảnh"
                accept="image/*"
                isImage
                files={contractForm.signedImages}
                uploading={uploading === "signed"}
                onFilesSelected={(files) => void uploadBatchFiles(files, "signed")}
                onRemove={removeContractSignedImage}
                onPreview={previewFile}
              />
            </div>

            <label className="col-span-2 text-xs">
              Ghi chú
              <textarea
                className={input}
                value={contractForm.note}
                onChange={(e) => setContractForm({ ...contractForm, note: e.target.value })}
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
          valid={Boolean(extensionForm.contractId && extensionForm.newEndDate && extensionForm.extensionDate)}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <label className="block text-xs">
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
                      {c.employeeName} — {c.contractType} — hạn {date(c.endDate)}
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
            <label className="block text-xs">
              Lý do
              <textarea
                className={input}
                value={extensionForm.reason}
                onChange={(e) => setExtensionForm({ ...extensionForm, reason: e.target.value })}
              />
            </label>

            {/* Drag & Drop: Extension Files */}
            <DropzoneUpload
              label="File phụ lục/gia hạn (PDF, DOC, DOCX)"
              acceptNotice="Kéo thả hoặc chọn nhiều tệp phụ lục (PDF, DOC, DOCX) · Tối đa 10 MB/tệp"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              files={extensionForm.extensionFiles}
              uploading={uploading === "extension"}
              onFilesSelected={(files) => void uploadBatchFiles(files, "extension")}
              onRemove={removeExtensionFile}
              onPreview={previewFile}
            />

            {/* Drag & Drop: Extension Signed Images */}
            <DropzoneUpload
              label="Ảnh phụ lục đã ký"
              acceptNotice="Kéo thả hoặc chọn nhiều ảnh phụ lục (JPG, PNG, WEBP) · Tối đa 10 MB/ảnh"
              accept="image/*"
              isImage
              files={extensionForm.signedImages}
              uploading={uploading === "extensionSigned"}
              onFilesSelected={(files) => void uploadBatchFiles(files, "extensionSigned")}
              onRemove={removeExtensionSignedImage}
              onPreview={previewFile}
            />
          </div>
        </Modal>
      )}
      <ContractPreviewModal
        data={contractPreviewData}
        onClose={() => setContractPreviewData(null)}
      />
      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} hideShare />
    </div>
  );
}

function DropzoneUpload({
  label,
  acceptNotice,
  accept,
  isImage,
  files,
  uploading,
  onFilesSelected,
  onRemove,
  onPreview,
}: {
  label: string;
  acceptNotice: string;
  accept: string;
  isImage?: boolean;
  files: ContractFileItem[];
  uploading: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemove: (index: number) => void;
  onPreview: (file: ContractFileItem) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  };

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-slate-700">{label}</span>
        {files.length > 0 && (
          <span className="text-[11px] font-medium text-slate-400">Đã chọn: {files.length} tệp</span>
        )}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? isImage
              ? "border-indigo-500 bg-indigo-50/80 ring-4 ring-indigo-500/15 scale-[1.01]"
              : "border-cyan-500 bg-cyan-50/80 ring-4 ring-cyan-500/15 scale-[1.01]"
            : isImage
              ? "border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30"
              : "border-slate-200 hover:border-cyan-400 bg-slate-50/60 hover:bg-cyan-50/30"
        } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={accept}
          disabled={uploading}
          onChange={(event) => {
            const selected = Array.from(event.target.files || []);
            if (selected.length > 0) onFilesSelected(selected);
            event.currentTarget.value = "";
          }}
        />
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs transition-transform duration-200 ${
            isImage ? "bg-indigo-100 text-indigo-600" : "bg-cyan-100 text-cyan-600"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isImage ? (
            <ImageIcon className="h-5 w-5" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs font-semibold text-slate-700">
            {uploading ? (
              "Đang tải lên tệp..."
            ) : (
              <>
                Kéo thả {isImage ? "ảnh" : "tệp"} vào đây hoặc{" "}
                <span className={isImage ? "text-indigo-600 font-bold underline" : "text-cyan-600 font-bold underline"}>
                  chọn từ máy
                </span>
              </>
            )}
          </p>
          <p className="text-[11px] text-slate-400">{acceptNotice}</p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {isImage ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs hover:border-indigo-300 transition"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview(file);
                        }}
                        title="Xem trước ảnh"
                        className="rounded-lg bg-white/90 p-1.5 text-indigo-700 hover:bg-white transition cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(idx);
                        }}
                        title="Xóa ảnh"
                        className="rounded-lg bg-white/90 p-1.5 text-rose-600 hover:bg-white transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 px-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate max-w-[100px]" title={file.name}>
                      {file.name}
                    </span>
                    <span>{formatSize(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {files.map((file, idx) => {
                const isPdf = file.name.toLowerCase().endsWith(".pdf");
                const isDoc = /\.(docx|doc)$/i.test(file.name);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isPdf
                            ? "bg-rose-50 text-rose-600"
                            : isDoc
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <FileText size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800" title={file.name}>
                          {file.name}
                        </p>
                        {file.size ? (
                          <p className="text-[10px] text-slate-400">{formatSize(file.size)}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPreview(file)}
                        title="Xem trước tệp"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Xem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(idx)}
                        title="Xóa tệp"
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
  maxWidth = "max-w-xl",
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  save: () => void;
  saving: boolean;
  valid: boolean;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className={`w-full ${maxWidth} max-h-[92vh] flex flex-col rounded-2xl bg-white p-5 shadow-2xl overflow-hidden`}>
        <h3 className="mb-4 font-bold text-slate-900 shrink-0">{title}</h3>
        <div className="overflow-y-auto flex-1 pr-1">{children}</div>
        <div className="mt-5 flex justify-end gap-2 shrink-0">
          <button onClick={close} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
            Hủy
          </button>
          <button
            disabled={!valid || saving}
            onClick={save}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 disabled:opacity-50 transition"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContractPreviewModal({
  data,
  onClose,
}: {
  data: ContractPreviewData | null;
  onClose: () => void;
}) {
  if (!data) return null;
  return (
    <ContractPreviewModalContent
      key={`${data.title}-${data.initialTab || "default"}-${data.initialFileIndex || 0}`}
      data={data}
      onClose={onClose}
    />
  );
}

function ContractPreviewModalContent({
  data,
  onClose,
}: {
  data: ContractPreviewData;
  onClose: () => void;
}) {
  const initialTab = data.initialTab || (data.contractFiles.length > 0 ? "contract" : "signed");
  const [activeTab, setActiveTab] = useState<"contract" | "signed">(initialTab);
  const [contractFileIndex, setContractFileIndex] = useState(initialTab === "contract" ? data.initialFileIndex || 0 : 0);
  const [signedImageIndex, setSignedImageIndex] = useState(initialTab === "signed" ? data.initialFileIndex || 0 : 0);
  const [downloading, setDownloading] = useState(false);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const currentFiles = activeTab === "contract" ? data.contractFiles : data.signedImages;
  const currentIndex = activeTab === "contract" ? contractFileIndex : signedImageIndex;
  const currentFile = currentFiles[currentIndex] || currentFiles[0];

  const handleDownload = async () => {
    if (!currentFile?.url || downloading) return;
    try {
      setDownloading(true);
      const url = currentFile.url;
      const filename = currentFile.name || (activeTab === "contract" ? "hop-dong.pdf" : "anh-ky.jpg");

      if (url.startsWith("blob:") || url.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const token = localStorage.getItem("accessToken");
      const downloadHref = `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(downloadHref, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("[Download Error]:", e);
      toast.error("Không thể tải xuống tệp.");
    } finally {
      setDownloading(false);
    }
  };

  const isCurrentPdf =
    currentFile &&
    (currentFile.name.toLowerCase().endsWith(".pdf") || currentFile.mimeType === "application/pdf");
  const isCurrentDocx =
    currentFile &&
    (currentFile.name.toLowerCase().endsWith(".docx") ||
      (currentFile.mimeType || "").includes("wordprocessingml"));
  const isCurrentDoc = currentFile && currentFile.name.toLowerCase().endsWith(".doc");
  const isCurrentImage =
    currentFile &&
    (activeTab === "signed" ||
      (currentFile.mimeType || "").startsWith("image/") ||
      /\.(png|jpg|jpeg|webp|gif)$/i.test(currentFile.name));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 bg-white">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900" title={data.title}>
              {data.title}
            </h3>
            {data.subtitle && (
              <p className="truncate text-[11px] text-slate-500" title={data.subtitle}>
                {data.subtitle}
              </p>
            )}
          </div>

          {/* 2 Tabs: "Hợp đồng" & "Đã ký" */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("contract");
                setDocxError(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "contract"
                  ? "bg-white text-cyan-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText size={14} className={activeTab === "contract" ? "text-cyan-600" : "text-slate-400"} />
              <span>Hợp đồng</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "contract" ? "bg-cyan-100 text-cyan-800" : "bg-slate-200 text-slate-600"
                }`}
              >
                {data.contractFiles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("signed");
                setDocxError(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "signed"
                  ? "bg-white text-indigo-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck2 size={14} className={activeTab === "signed" ? "text-indigo-600" : "text-slate-400"} />
              <span>Đã ký</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "signed" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-600"
                }`}
              >
                {data.signedImages.length}
              </span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {currentFile && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800 transition disabled:opacity-50 cursor-pointer"
                title="Tải xuống tệp đang xem"
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span className="hidden sm:inline">Tải xuống</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Multi-file switcher bar (if more than 1 file in active tab) */}
        {activeTab === "contract" && data.contractFiles.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-4 py-2">
            <span className="text-[11px] font-medium text-slate-400 shrink-0">Danh sách tệp:</span>
            {data.contractFiles.map((file, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setContractFileIndex(idx);
                  setDocxError(false);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition shrink-0 cursor-pointer ${
                  contractFileIndex === idx
                    ? "border border-cyan-400 bg-cyan-100/70 text-cyan-900 font-bold shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100/70"
                }`}
              >
                <FileText size={12} className={contractFileIndex === idx ? "text-cyan-600" : "text-slate-400"} />
                <span className="max-w-[150px] truncate">{file.name || `Tệp ${idx + 1}`}</span>
                {file.size ? <span className="text-[10px] opacity-70">({formatSize(file.size)})</span> : null}
              </button>
            ))}
          </div>
        )}

        {activeTab === "signed" && data.signedImages.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-4 py-2">
            <span className="text-[11px] font-medium text-slate-400 shrink-0">Trang ảnh ký:</span>
            {data.signedImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSignedImageIndex(idx)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition shrink-0 cursor-pointer ${
                  signedImageIndex === idx
                    ? "border border-indigo-400 bg-indigo-100/70 text-indigo-900 font-bold shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100/70"
                }`}
              >
                <ImageIcon size={12} className={signedImageIndex === idx ? "text-indigo-600" : "text-slate-400"} />
                <span className="max-w-[130px] truncate">{img.name || `Ảnh ${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content Viewer Body */}
        <div className="relative min-h-0 flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
          {currentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-3 ${
                  activeTab === "contract" ? "bg-cyan-50 text-cyan-500" : "bg-indigo-50 text-indigo-500"
                }`}
              >
                {activeTab === "contract" ? <FileText size={32} /> : <FileCheck2 size={32} />}
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {activeTab === "contract" ? "Chưa có tệp văn bản hợp đồng" : "Chưa có ảnh hợp đồng đã ký"}
              </h4>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {activeTab === "contract"
                  ? "Hồ sơ này chưa tải lên tệp văn bản hợp đồng (PDF hoặc Word)."
                  : "Hồ sơ này chưa tải lên ảnh chụp hoặc bản scan hợp đồng có chữ ký/con dấu."}
              </p>
            </div>
          ) : isCurrentImage ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <img
                src={currentFile.url}
                alt={currentFile.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md transition"
              />
            </div>
          ) : isCurrentPdf ? (
            <iframe
              src={
                currentFile.url.startsWith("blob:") ||
                currentFile.url.startsWith("data:") ||
                currentFile.url.includes("localhost") ||
                currentFile.url.includes("127.0.0.1")
                  ? currentFile.url
                  : `https://docs.google.com/gview?url=${encodeURIComponent(currentFile.url)}&embedded=true`
              }
              title={currentFile.name}
              className="h-full w-full border-0 bg-white"
            />
          ) : isCurrentDocx && !docxError ? (
            <React.Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              }
            >
              <DocxPreview
                downloadHref={`/api/v1/media/download?url=${encodeURIComponent(currentFile.url)}&filename=${encodeURIComponent(currentFile.name)}`}
                fileName={currentFile.name}
                onError={() => setDocxError(true)}
              />
            </React.Suspense>
          ) : (
            /* Fallback for .doc or failed preview */
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto">
              <FileText className="h-14 w-14 text-blue-500 mb-3" strokeWidth={1.5} />
              <h4 className="text-sm font-bold text-slate-800">{currentFile.name}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {isCurrentDoc
                  ? "Định dạng .doc cũ không hỗ trợ xem trực tiếp. Vui lòng tải xuống hoặc chuyển sang .docx/.pdf."
                  : "Không thể hiển thị bản xem trước cho định dạng này."}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 transition cursor-pointer"
              >
                <Download size={14} />
                <span>Tải xuống tệp</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {currentFile && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-2 text-[11px] text-slate-500 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-700 truncate">{currentFile.name}</span>
              {currentFile.size ? <span>· {formatSize(currentFile.size)}</span> : null}
            </div>
            <div className="shrink-0 text-slate-400">
              {activeTab === "contract"
                ? `Tệp ${contractFileIndex + 1}/${data.contractFiles.length}`
                : `Ảnh ${signedImageIndex + 1}/${data.signedImages.length}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
