import "../../shared/marketing-workspace.css";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Bot,
  ChevronDown,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  MessageSquare,
  MessageSquareText,
  Package,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { cn } from "../../../student-management/lib/utils";
import { ModuleNavigation, ModuleNavigationButton } from "../../../../components/common/ModuleNavigation";
import { useAuth } from "../../shared/context/AuthContext";
import { PageChatSimulator } from "../components/knowledge/PageChatSimulator";
import { useSubTabRouter } from "../../../../hooks/useSubTabRouter";
import { FaqLearningSuggestionsPanel } from "../components/knowledge/FaqLearningSuggestionsPanel";
import { KnowledgeDocumentTypeSelect } from "../components/knowledge/KnowledgeDocumentTypeSelect";
import {
  CompanyKnowledgeDocument,
  CompanyKnowledgeHealth,
  KnowledgeChannelScope,
  KnowledgeDocumentType,
  KnowledgePageScope,
  KnowledgePurposeScope,
  TestSearchResult,
  companyKnowledgeService,
} from "../services/companyKnowledgeService";
import {
  SocialIntegration,
  socialIntegrationService,
} from "../../shared/services/socialIntegrationService";
import { toast } from "../../../../pages/Toast";

type KnowledgeSection = "documents" | "faq_learning" | "test_search" | "page_chat";

const KNOWLEDGE_SECTION_ROUTES = [
  { slug: "documents", value: "documents" },
  { slug: "page-chat", value: "page_chat" },
] as const satisfies ReadonlyArray<{ slug: string; value: KnowledgeSection }>;

const PURPOSES: Array<{
  id: KnowledgePurposeScope;
  label: string;
}> = [
    { id: "all", label: "Toàn hệ thống" },
    { id: "sales", label: "Sale" },
    { id: "support", label: "Chăm sóc khách hàng" },
    { id: "marketing", label: "Marketing" },
    { id: "caption", label: "Caption video" },
  ];

const CHANNELS: Array<{
  id: KnowledgeChannelScope;
  label: string;
}> = [
    { id: "all", label: "Mọi kênh" },
    { id: "facebook", label: "Facebook" },
    { id: "zalo", label: "Zalo" },
    { id: "tiktok", label: "TikTok" },
  ];

const DOCUMENT_TYPES: Array<{ id: KnowledgeDocumentType; label: string }> = [
  { id: "general", label: "Tự động nhận diện / tài liệu chung" },
  { id: "company_profile", label: "Thông tin công ty" },
  { id: "product", label: "Sản phẩm" },
  { id: "service", label: "Dịch vụ" },
  { id: "pricing", label: "Bảng giá" },
  { id: "promotion", label: "Khuyến mãi / Ưu đãi" },
  { id: "policy", label: "Chính sách" },
  { id: "faq", label: "Câu hỏi thường gặp" },
  { id: "brand_guideline", label: "Nhận diện thương hiệu" },
  { id: "scenario", label: "Kịch bản chăm sóc khách hàng" },
];

function KnowledgeNavIcon({ id }: { id: KnowledgeDocumentType | "page_chat" }) {
  const gradientId = useId().replace(/:/g, "");
  const main = `url(#${gradientId})`;
  const cutout = "var(--color-surface-container-lowest)";

  const shape = (() => {
    switch (id) {
      case "company_profile":
        return (
          <>
            <rect x="3.6" y="2.8" width="16.8" height="18.4" rx="3.8" />
            <path d="M9.6 21.2v-4.2a2.4 2.4 0 0 1 4.8 0v4.2" fill={cutout} />
            <rect x="7.4" y="6.8" width="2.5" height="2.5" rx="0.9" fill={cutout} />
            <rect x="14.1" y="6.8" width="2.5" height="2.5" rx="0.9" fill={cutout} />
            <rect x="7.4" y="11" width="2.5" height="2.5" rx="0.9" fill={cutout} />
            <rect x="14.1" y="11" width="2.5" height="2.5" rx="0.9" fill={cutout} />
          </>
        );
      case "policy":
        return (
          <>
            <path d="M12 2.4c3 1.6 5.9 2.2 8 2.4.7.1 1.2.6 1.2 1.3v5.1c0 5.1-3.3 8.6-8.4 10.3a2.4 2.4 0 0 1-1.6 0C6.1 19.8 2.8 16.3 2.8 11.2V6.1c0-.7.5-1.2 1.2-1.3 2.1-.2 5-.8 8-2.4Z" />
            <path
              d="m8.6 12.1 2.3 2.3 4.6-4.7"
              fill="none"
              stroke={cutout}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      case "scenario":
        return (
          <>
            <path d="M5.6 3.2h12.8A3.4 3.4 0 0 1 21.8 6.6v8.2a3.4 3.4 0 0 1-3.4 3.4H10l-4.7 3.1a.9.9 0 0 1-1.4-.75V18a3.3 3.3 0 0 1-1.7-2.9V6.6a3.4 3.4 0 0 1 3.4-3.4Z" />
            <path
              d="M7.5 9.2h9m-9 3.6h5.6"
              fill="none"
              stroke={cutout}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </>
        );
      case "product":
        return (
          <>
            <path d="M10.8 2.8a2.5 2.5 0 0 1 2.4 0l6.8 3.8a2.4 2.4 0 0 1 1.2 2.1v6.6a2.4 2.4 0 0 1-1.2 2.1l-6.8 3.8a2.5 2.5 0 0 1-2.4 0L4 17.4a2.4 2.4 0 0 1-1.2-2.1V8.7A2.4 2.4 0 0 1 4 6.6l6.8-3.8Z" />
            <path
              d="M4 7.7 12 12l8-4.3M12 12v8.8"
              fill="none"
              stroke={cutout}
              strokeWidth="1.85"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      case "page_chat":
      default:
        return (
          <>
            <rect x="3" y="6" width="18" height="14.2" rx="5.2" />
            <path
              d="M12 3.4v2.8"
              fill="none"
              stroke={main}
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <circle cx="12" cy="3" r="1.6" />
            <rect x="6.3" y="9.4" width="11.4" height="7.2" rx="3.4" fill={cutout} />
            <circle cx="9.6" cy="12.9" r="1.35" />
            <circle cx="14.4" cy="12.9" r="1.35" />
          </>
        );
    }
  })();

  return (
    <svg
      viewBox="0 0 24 24"
      fill={main}
      style={{ stroke: "none" }}
      className="size-5"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4db2fa" />
          <stop offset="48%" stopColor="#2196f3" />
          <stop offset="100%" stopColor="#1982e6" />
        </linearGradient>
      </defs>
      {shape}
    </svg>
  );
}

const KNOWLEDGE_SECTIONS: Array<{
  id: KnowledgeDocumentType;
  label: string;
  description: string;
  types: KnowledgeDocumentType[];
  icon: LucideIcon;
}> = [
  { id: "company_profile", label: "Giới thiệu", description: "Doanh nghiệp, địa chỉ, giờ mở cửa, liên hệ", types: ["company_profile"], icon: Building2 },
  { id: "policy", label: "Chính sách", description: "Giao hàng, thanh toán, đặt trước, đổi trả", types: ["policy"], icon: ShieldCheck },
  { id: "scenario", label: "Kịch bản", description: "Cách tư vấn và xử lý tình huống với khách", types: ["scenario"], icon: MessageSquareText },
  { id: "product", label: "Sản phẩm/Bảng giá", description: "Sản phẩm, thành phần, kích thước và giá bán", types: ["product", "pricing"], icon: Package },
];

function toggleScope<T extends string>(current: T[], value: T) {
  if (value === "all") return ["all"] as T[];
  const withoutAll = current.filter((item) => item !== "all");
  const next = withoutAll.includes(value)
    ? withoutAll.filter((item) => item !== value)
    : [...withoutAll, value];
  return next.length ? next : (["all"] as T[]);
}

function getShortDriveLink(value: string) {
  const link = value.trim();
  if (link.length <= 52) return link;

  try {
    const url = new URL(link);
    const folderId = url.pathname.match(/\/folders\/([^/]+)/)?.[1];
    if (folderId) {
      return `${url.hostname}/folders/${folderId.slice(0, 12)}…`;
    }
    return `${url.hostname}${url.pathname.slice(0, 28)}…`;
  } catch {
    return `${link.slice(0, 48)}…`;
  }
}

function ScopePicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-700">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(toggleScope(value, option.id))}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${active
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-200"
                }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PageScopePicker({
  pages,
  pageScope,
  pageIds,
  onScopeChange,
  onPageIdsChange,
}: {
  pages: SocialIntegration[];
  pageScope: KnowledgePageScope;
  pageIds: string[];
  onScopeChange: (scope: KnowledgePageScope) => void;
  onPageIdsChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="mb-2 text-xs font-semibold text-slate-700">
        Facebook Page sử dụng tài liệu
      </legend>
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "Đồng bộ cho mọi Page"],
          ["selected", "Chỉ Page được chọn"],
        ] as const).map(([scope, label]) => (
          <button
            key={scope}
            type="button"
            onClick={() => {
              onScopeChange(scope);
              if (scope === "all") onPageIdsChange([]);
            }}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${pageScope === scope
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-500"
              }`}
          >
            {label}
          </button>
        ))}
      </div>
      {pageScope === "selected" && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {pages.length === 0 ? (
            <p className="text-xs text-amber-600">
              Chưa có Facebook Page nào đang kết nối.
            </p>
          ) : pages.map((page) => {
            const pageId = page.username || "";
            return (
              <label key={page._id || pageId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={pageIds.includes(pageId)}
                  onChange={() => onPageIdsChange(
                    pageIds.includes(pageId)
                      ? pageIds.filter((id) => id !== pageId)
                      : [...pageIds, pageId]
                  )}
                />
                <span className="truncate">{page.displayName}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export default function CompanyKnowledgePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("company-knowledge:manage");
  const [health, setHealth] = useState<CompanyKnowledgeHealth | null>(null);
  const [documents, setDocuments] = useState<CompanyKnowledgeDocument[]>([]);
  const [facebookPages, setFacebookPages] = useState<SocialIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [importMethod, setImportMethod] = useState<"file" | "drive">("file");
  const [driveLink, setDriveLink] = useState("");
  const [isDriveLinkFocused, setIsDriveLinkFocused] = useState(false);
  const [purposeScope, setPurposeScope] = useState<KnowledgePurposeScope[]>([
    "all",
  ]);
  const [channelScope, setChannelScope] = useState<KnowledgeChannelScope[]>([
    "all",
  ]);
  const [pageScope, setPageScope] = useState<KnowledgePageScope>("all");
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<KnowledgeDocumentType>("company_profile");
  const [selectedKnowledgeSection, setSelectedKnowledgeSection] = useState<KnowledgeDocumentType | "all" | "other">("company_profile");
  const [editingId, setEditingId] = useState("");
  const [editPurposeScope, setEditPurposeScope] = useState<
    KnowledgePurposeScope[]
  >(["all"]);
  const [editChannelScope, setEditChannelScope] = useState<
    KnowledgeChannelScope[]
  >(["all"]);
  const [editPageScope, setEditPageScope] = useState<KnowledgePageScope>("all");
  const [editPageIds, setEditPageIds] = useState<string[]>([]);
  const [editDocumentType, setEditDocumentType] = useState<KnowledgeDocumentType>("general");

  const [activeSection, setActiveSection] = useSubTabRouter<KnowledgeSection>(KNOWLEDGE_SECTION_ROUTES, "documents");
  const [pageChatToolbarContainer, setPageChatToolbarContainer] = useState<HTMLDivElement | null>(null);

  // State cho RAG Search Simulator
  const [testQuery, setTestQuery] = useState("");
  const [testingSearch, setTestingSearch] = useState(false);
  const [testResult, setTestResult] = useState<TestSearchResult | null>(null);
  const [showMatchedChunks, setShowMatchedChunks] = useState(false);

  async function handleTestSearch() {
    if (!testQuery.trim()) {
      toast.error("Vui lòng nhập câu hỏi để thử nghiệm.");
      return;
    }
    setTestingSearch(true);
    try {
      const result = await companyKnowledgeService.testSearch(testQuery.trim());
      setTestResult(result);
      if (result.matches === 0) {
        toast.info("Không tìm thấy khối tri thức nào khớp với câu hỏi này.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thử nghiệm tìm kiếm thất bại.");
    } finally {
      setTestingSearch(false);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHealth, nextDocuments, integrations] = await Promise.all([
        companyKnowledgeService.health(),
        companyKnowledgeService.listDocuments(),
        socialIntegrationService.getAccounts("company-knowledge", "Facebook").catch(() => []),
      ]);
      setHealth(nextHealth);
      setDocuments(nextDocuments);
      setFacebookPages(integrations.filter((item) => item.isConnected && item.username));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tải kho tri thức doanh nghiệp."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The legacy loader resets request UI before asynchronously reading company knowledge.
    void loadData();
  }, [loadData]);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const section = KNOWLEDGE_SECTIONS.find((item) => item.id === selectedKnowledgeSection);
    return documents.filter((document) => {
      if (section && !section.types.includes(document.documentType)) return false;
      if (selectedKnowledgeSection === "other" && KNOWLEDGE_SECTIONS.some((item) => item.types.includes(document.documentType))) return false;
      return !normalized || [document.title, document.sourceType, ...document.purposeScope]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [documents, query, selectedKnowledgeSection]);

  async function syncDrive() {
    if (!driveLink.trim()) {
      toast.error("Hãy nhập link Google Drive, Doc hoặc Sheet công khai.");
      return;
    }
    if (pageScope === "selected" && pageIds.length === 0) {
      toast.error("Hãy chọn ít nhất một Facebook Page.");
      return;
    }
    setBusy(true);
    try {
      const result = await companyKnowledgeService.syncDrive(
        driveLink.trim(),
        { purposeScope, channelScope, pageScope, pageIds, documentType }
      );
      toast.success(
        `Đã nhập ${result.documentsCount || 1} tài liệu vào kho tri thức.`
      );
      setDriveLink("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đồng bộ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tài liệu vượt quá giới hạn 10 MB.");
      return;
    }
    if (pageScope === "selected" && pageIds.length === 0) {
      toast.error("Hãy chọn ít nhất một Facebook Page.");
      return;
    }
    setBusy(true);
    try {
      const result = await companyKnowledgeService.upload(file, {
        purposeScope,
        channelScope,
        pageScope,
        pageIds,
        documentType,
      });
      toast.success(`Đã nhập ${result.title} vào kho tri thức.`);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Tải tài liệu thất bại."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveScopes(documentId: string) {
    if (editPageScope === "selected" && editPageIds.length === 0) {
      toast.error("Hãy chọn ít nhất một Facebook Page.");
      return;
    }
    setBusy(true);
    try {
      await companyKnowledgeService.updateScopes(documentId, {
        purposeScope: editPurposeScope,
        channelScope: editChannelScope,
        pageScope: editPageScope,
        pageIds: editPageIds,
        documentType: editDocumentType,
      });
      setEditingId("");
      toast.success("Đã cập nhật phạm vi sử dụng.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cập nhật thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(document: CompanyKnowledgeDocument) {
    if (!window.confirm(`Xóa tài liệu “${document.title}”?`)) return;
    setBusy(true);
    try {
      const result = await companyKnowledgeService.deleteDocument(document.id);
      toast.success(result.message);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xóa tài liệu thất bại."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDocumentById(documentId: string, title?: string) {
    if (!window.confirm(`Xóa tài liệu “${title || documentId}”?\n\nTài liệu và các khối tri thức liên quan sẽ bị xóa khỏi hệ thống.`)) return;
    setBusy(true);
    try {
      const result = await companyKnowledgeService.deleteDocument(documentId);
      toast.success(result.message || `Đã xóa tài liệu “${title || documentId}” thành công.`);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xóa tài liệu thất bại."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoCleanAllDuplicates() {
    const duplicateConflicts = (health?.conflicts || []).filter(c => c.type === "duplicate");
    if (duplicateConflicts.length === 0) return;

    const docBIdsToDelete = Array.from(new Set(duplicateConflicts.map(c => c.documentB.id).filter(Boolean)));
    if (docBIdsToDelete.length === 0) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn tự động xóa ${docBIdsToDelete.length} bản sao tài liệu bị trùng lặp 100% nội dung?\n\nHệ thống sẽ giữ lại bản gốc (Tài liệu A) và xóa các bản sao trùng lặp (Tài liệu B).`
    );
    if (!confirmed) return;

    setBusy(true);
    let successCount = 0;
    try {
      for (const id of docBIdsToDelete) {
        try {
          await companyKnowledgeService.deleteDocument(id);
          successCount++;
        } catch (err) {
          console.error(`Failed to delete doc ${id}:`, err);
        }
      }
      toast.success(`Đã xóa thành công ${successCount} tài liệu trùng lặp!`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa tài liệu trùng lặp thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const activeNavValue =
    activeSection === "page_chat"
      ? "page_chat"
      : selectedKnowledgeSection;

  return (
    <div className="marketing-workspace flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface">
      {/* Vertical ModuleNavigation Sidebar */}
      <ModuleNavigation
        label="Điều hướng kho tri thức"
        activeValue={activeNavValue}
      >
        {KNOWLEDGE_SECTIONS.map((section) => {
          const isActive = activeSection === "documents" && selectedKnowledgeSection === section.id;
          const count = documents.filter((document) => section.types.includes(document.documentType)).length;
          return (
            <ModuleNavigationButton
              key={section.id}
              active={isActive}
              disabled={busy}
              icon={<KnowledgeNavIcon id={section.id} />}
              filledIcon={<KnowledgeNavIcon id={section.id} />}
              preferProvidedIcon
              onClick={() => {
                setActiveSection("documents");
                setSelectedKnowledgeSection(section.id);
                setDocumentType(section.id);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>{section.label}</span>
                {count > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums", isActive ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface-variant")}>
                    {count}
                  </span>
                )}
              </span>
            </ModuleNavigationButton>
          );
        })}
        <ModuleNavigationButton
          active={activeSection === "page_chat"}
          icon={<KnowledgeNavIcon id="page_chat" />}
          filledIcon={<KnowledgeNavIcon id="page_chat" />}
          preferProvidedIcon
          onClick={() => setActiveSection("page_chat")}
        >
          Mô phỏng chat Page
        </ModuleNavigationButton>
      </ModuleNavigation>

      <div
        className={cn(
          "min-h-0 flex-1 rounded-md border border-outline-variant bg-surface-container-lowest",
          activeSection === "page_chat"
            ? "flex flex-col overflow-hidden"
            : "overflow-y-auto px-4 pb-8 sm:px-5",
        )}
      >
        {activeSection === "page_chat" && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-outline-variant px-4 py-2.5">
            <div ref={setPageChatToolbarContainer} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2" />
          </div>
        )}
        {activeSection === "documents" && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-outline-variant py-2.5">
            <div className="flex shrink-0 items-center gap-1.5">
              {([["all", "Tất cả tài liệu"], ["other", "Tài liệu khác"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  aria-pressed={selectedKnowledgeSection === id}
                  onClick={() => setSelectedKnowledgeSection(id)}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50",
                    selectedKnowledgeSection === id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {canManage && (
              <>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="hidden shrink-0 text-xs font-medium text-on-surface-variant 2xl:inline">Mục lưu</span>
                  <KnowledgeDocumentTypeSelect
                    value={documentType}
                    disabled={busy}
                    className="w-40"
                    compact
                    onChange={(type) => {
                      setDocumentType(type);
                      setSelectedKnowledgeSection(KNOWLEDGE_SECTIONS.find((section) => section.types.includes(type))?.id || "other");
                    }}
                    groups={[
                      { options: KNOWLEDGE_SECTIONS.map((section) => ({ id: section.id, label: section.label })) },
                      { label: "Các loại tài liệu khác", options: DOCUMENT_TYPES.filter((type) => !KNOWLEDGE_SECTIONS.some((section) => section.id === type.id)) },
                    ]}
                  />
                </div>

                <div className="grid h-9 w-48 shrink-0 grid-cols-2 gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1">
                  <button
                    type="button"
                    onClick={() => setImportMethod("file")}
                    aria-pressed={importMethod === "file"}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors select-none cursor-pointer",
                      importMethod === "file"
                        ? "bg-primary text-on-primary shadow-xs"
                        : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    <Upload className="size-3.5" aria-hidden="true" />
                    Tải file
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod("drive")}
                    aria-pressed={importMethod === "drive"}
                    className={cn(
                      "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors select-none cursor-pointer",
                      importMethod === "drive"
                        ? "bg-primary text-on-primary shadow-xs"
                        : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    <Link2 className="size-3.5" aria-hidden="true" />
                    Google Drive
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeSection === "page_chat" && <PageChatSimulator toolbarContainer={pageChatToolbarContainer} />}
        {activeSection === "faq_learning" && (
          <div className="mt-5">
            <FaqLearningSuggestionsPanel onKnowledgeUpdated={() => void loadData()} />
          </div>
        )}

        {activeSection === "test_search" && (
          <div className="mt-5 space-y-5">
            {/* RAG Search Simulator Component */}
            <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-5 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Thử nghiệm tìm kiếm tri thức (RAG Search Simulator)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Gõ thử câu hỏi của khách hàng để kiểm tra AI có tìm đúng tài liệu và trả lời chuẩn không
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <MessageSquare className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" />
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !testingSearch) {
                        void handleTestSearch();
                      }
                    }}
                    placeholder="Ví dụ: Áo polo giá bao nhiêu, ship về Hà Nội mất mấy ngày, có bảo hành ko?..."
                    className="w-full rounded-xl border border-indigo-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleTestSearch()}
                  disabled={testingSearch || !testQuery.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {testingSearch ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Kiểm tra
                </button>
              </div>

              {testResult && (
                <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-white p-4 text-xs shadow-xs">
                  {/* Intent & Match Stats */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-700">Intent nhận diện:</span>
                      {testResult.detectedDocumentTypes?.length > 0 ? (
                        testResult.detectedDocumentTypes.map((type) => (
                          <span
                            key={type}
                            className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200"
                          >
                            {DOCUMENT_TYPES.find((t) => t.id === type)?.label || type}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          Toàn bộ kho tri thức
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                      <span>
                        Khớp: <strong className="text-indigo-600 font-bold">{testResult.matches} khối</strong>
                      </span>
                      <span>
                        Điểm cao nhất: <strong className="text-emerald-600 font-bold">{(testResult.bestScore || 0).toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Simulated Answer */}
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1.5">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                      Câu trả lời mẫu AI sẽ gửi cho khách:
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs leading-relaxed text-slate-800 whitespace-pre-line">
                      {testResult.simulatedAnswer || "(Chưa có câu trả lời)"}
                    </div>
                  </div>

                  {/* Matched Chunks Breakdown */}
                  {testResult.items?.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowMatchedChunks(!showMatchedChunks)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${showMatchedChunks ? "rotate-180" : ""}`}
                        />
                        {showMatchedChunks ? "Ẩn các đoạn tri thức đã trích xuất" : `Xem ${testResult.items.length} đoạn tri thức đã trích xuất`}
                      </button>

                      {showMatchedChunks && (
                        <div className="mt-2 space-y-2">
                          {testResult.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-[11px] leading-relaxed"
                            >
                              <div className="flex items-center justify-between gap-2 font-semibold text-slate-700 mb-1">
                                <span className="truncate">
                                  #{idx + 1} · {item.title} ({item.documentType})
                                </span>
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Score: {item.score.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-slate-600 whitespace-pre-line font-mono text-[10px]">
                                {item.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activeSection === "documents" && (
          <>
            {!canManage && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 text-blue-650" />
                Bạn đang ở chế độ xem. Manager hoặc Admin có thể nhập và quản lý
                tài liệu.
              </div>
            )}

            {canManage && (
              <section className="mt-5">
                <div>
                  {importMethod === "file" ? (
                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-4 text-center hover:border-blue-400 hover:bg-blue-50">
                      {busy ? (
                        <LoaderCircle className="h-5 w-5 animate-spin text-blue-650" />
                      ) : (
                        <Upload className="h-5 w-5 text-blue-650" />
                      )}
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          Chọn file từ máy
                        </span>
                        <span className="text-[11px] text-slate-500">
                          PDF, DOCX, XLSX, TXT, CSV, PNG, JPG, WEBP · tối đa 10 MB
                        </span>
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.md,.png,.jpg,.jpeg,.webp"
                        className="hidden"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadFile(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Link Google Drive, Google Doc hoặc Google Sheet
                        <div className="mt-2 flex gap-2">
                          <div className="relative min-w-0 flex-1">
                            <Link2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input
                              value={
                                isDriveLinkFocused
                                  ? driveLink
                                  : getShortDriveLink(driveLink)
                              }
                              onChange={(event) => setDriveLink(event.target.value)}
                              onFocus={() => setIsDriveLinkFocused(true)}
                              onBlur={() => setIsDriveLinkFocused(false)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void syncDrive();
                              }}
                              placeholder="Dán link chia sẻ công khai"
                              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void syncDrive()}
                            disabled={busy || !driveLink.trim()}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:opacity-100"
                          >
                            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                            {busy ? "Đang nhập..." : "Nhập"}
                          </button>
                        </div>
                      </label>
                      <p className="mt-2 text-[11px] leading-4 text-slate-500">
                        Drive phải bật quyền “Bất kỳ ai có liên kết đều có thể xem”.
                      </p>
                    </div>
                  )}
                </div>

                <details className="mt-4 border-t border-slate-100 pt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
                    <ChevronDown className="h-4 w-4" />
                    Tùy chọn phạm vi sử dụng
                  </summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <ScopePicker
                      label="Nghiệp vụ"
                      options={PURPOSES}
                      value={purposeScope}
                      onChange={setPurposeScope}
                    />
                    <ScopePicker
                      label="Kênh"
                      options={CHANNELS}
                      value={channelScope}
                      onChange={setChannelScope}
                    />
                    <PageScopePicker
                      pages={facebookPages}
                      pageScope={pageScope}
                      pageIds={pageIds}
                      onScopeChange={setPageScope}
                      onPageIdsChange={setPageIds}
                    />
                  </div>
                </details>

              </section>
            )}

            {(health?.conflicts || []).length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 text-rose-800 font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Phát hiện {health?.conflicts?.length} mâu thuẫn dữ liệu cần đối soát giữa các tài liệu:</span>
                  </div>
                  {canManage && (health?.conflicts || []).some(c => c.type === "duplicate") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAutoCleanAllDuplicates()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                      title="Tự động xóa tất cả bản sao bị trùng lặp 100% nội dung"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa tất cả bản sao trùng lặp</span>
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2.5">
                  {health?.conflicts?.map((conflict) => (
                    <div
                      key={conflict.id}
                      className="rounded-xl border border-rose-100 bg-white p-3.5 text-xs shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-700">{conflict.title}</span>
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 uppercase tracking-wider">
                          {conflict.type === "pricing"
                            ? "Lệch giá"
                            : conflict.type === "contact"
                              ? "Lệch Hotline"
                              : conflict.type === "policy"
                                ? "Lệch Chính sách"
                                : "Trùng lặp"}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        {conflict.description}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] pt-2 border-t border-slate-100">
                        <div className="rounded-xl bg-slate-50 p-2.5 flex flex-col justify-between gap-2 border border-slate-200/60">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-700">Tài liệu A:</span>
                              {conflict.type === "duplicate" && (
                                <span className="text-[9.5px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">Bản gốc</span>
                              )}
                            </div>
                            <p className="text-slate-800 font-semibold truncate mt-0.5" title={conflict.documentA.title}>
                              {conflict.documentA.title}
                            </p>
                            <div className="font-mono text-rose-600 font-bold mt-0.5 text-[10px]">↳ {conflict.conflictingValues.a}</div>
                          </div>
                          {canManage && conflict.documentA.id && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteDocumentById(conflict.documentA.id, conflict.documentA.title)}
                              className="mt-1 self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10.5px] transition border border-rose-200 cursor-pointer disabled:opacity-50"
                              title="Xóa tài liệu A này"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Xóa tài liệu A</span>
                            </button>
                          )}
                        </div>

                        <div className="rounded-xl bg-slate-50 p-2.5 flex flex-col justify-between gap-2 border border-slate-200/60">
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-700">Tài liệu B:</span>
                              {conflict.type === "duplicate" && (
                                <span className="text-[9.5px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-mono font-bold">Bản sao trùng</span>
                              )}
                            </div>
                            <p className="text-slate-800 font-semibold truncate mt-0.5" title={conflict.documentB.title}>
                              {conflict.documentB.title}
                            </p>
                            <div className="font-mono text-rose-600 font-bold mt-0.5 text-[10px]">↳ {conflict.conflictingValues.b}</div>
                          </div>
                          {canManage && conflict.documentB.id && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteDocumentById(conflict.documentB.id, conflict.documentB.title)}
                              className="mt-1 self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] transition shadow-xs cursor-pointer disabled:opacity-50"
                              title="Xóa tài liệu B (bản sao trùng lặp) này"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Xóa bản sao B {conflict.type === "duplicate" ? "(Khuyên dùng)" : ""}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(health?.warnings || []).length > 0 && !(health?.conflicts || []).length && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {health?.warnings[0]}
              </div>
            )}

            <section className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {KNOWLEDGE_SECTIONS.find((section) => section.id === selectedKnowledgeSection)?.label || (selectedKnowledgeSection === "other" ? "Tài liệu khác" : "Tất cả tài liệu")}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {health?.chunksCount || 0} khối tri thức đang được sử dụng
                  </p>
                </div>
                {documents.length > 5 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm tài liệu..."
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
                    />
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="flex justify-center p-10">
                    <LoaderCircle className="h-6 w-6 animate-spin text-blue-650" />
                  </div>
                ) : visibleDocuments.length === 0 ? (
                  <div className="p-10 text-center">
                    <FileText className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Chưa có tài liệu
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Chọn mục lưu rồi nhập file hoặc liên kết Drive để thêm tài liệu. Tài liệu đã có ở mục khác vẫn được giữ nguyên.
                    </p>
                  </div>
                ) : (
                  visibleDocuments.map((document) => (
                    <article key={document.id}>
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-slate-800">
                              {document.title}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {document.sourceType === "google_doc"
                                ? "Google Drive"
                                : "Tệp tải lên"}{" "}
                              · v{document.version} · {document.chunksCount} khối
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-blue-650">
                              {DOCUMENT_TYPES.find((type) => type.id === document.documentType)?.label || "Tài liệu chung"}
                              {" · "}
                              {document.pageScope === "selected"
                                ? `${document.pageIds.length} Facebook Page`
                                : "Mọi Facebook Page"}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {document.sourceUrl?.startsWith("http") && (
                            <a
                              href={document.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-650"
                              title="Mở nguồn"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(
                                    editingId === document.id ? "" : document.id
                                  );
                                  setEditPurposeScope(document.purposeScope);
                                  setEditChannelScope(document.channelScope);
                                  setEditPageScope(document.pageScope || "all");
                                  setEditPageIds(document.pageIds || []);
                                  setEditDocumentType(document.documentType || "general");
                                }}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-650"
                                title="Phạm vi sử dụng"
                              >
                                <Settings2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void deleteDocument(document)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                title="Xóa tài liệu"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editingId === document.id && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="text-xs font-medium text-slate-700">
                              <span>Loại tài liệu</span>
                              <KnowledgeDocumentTypeSelect
                                value={editDocumentType}
                                onChange={setEditDocumentType}
                                groups={[{ options: DOCUMENT_TYPES }]}
                                className="mt-2"
                              />
                            </div>
                            <ScopePicker
                              label="Nghiệp vụ"
                              options={PURPOSES}
                              value={editPurposeScope}
                              onChange={setEditPurposeScope}
                            />
                            <ScopePicker
                              label="Kênh"
                              options={CHANNELS}
                              value={editChannelScope}
                              onChange={setEditChannelScope}
                            />
                            <PageScopePicker
                              pages={facebookPages}
                              pageScope={editPageScope}
                              pageIds={editPageIds}
                              onScopeChange={setEditPageScope}
                              onPageIdsChange={setEditPageIds}
                            />
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId("")}
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveScopes(document.id)}
                              className="rounded-lg bg-blue-650 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
