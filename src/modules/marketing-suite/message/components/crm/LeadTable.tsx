import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlignLeft,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Columns3,
  DollarSign,
  Download,
  Hash,
  List,
  Loader2,
  Mail,
  MessageCircle,
  PanelRightOpen,
  Pencil,
  Phone,
  Plus,
  Settings2,
  Table2,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { toast } from "../../../../../pages/Toast";
import {
  LEAD_INTAKE_FIELD_TYPES,
  type LeadCollectionStatus,
  type LeadIntakeField,
  type LeadIntakeFieldType,
} from "../../../../../../shared/marketing-suite/lead-intake";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { ErpRefreshButton } from "../../../../../components/common/ErpRefreshButton";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { TableFilterToolbar } from "../../../../../components/common/TableFilterToolbar";
import { TablePagination } from "../../../../../components/common/TablePagination";
import { DateInput24 } from "../../../../../components/common/TimeInput24";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { HrEmptyIllustration } from "../../../../../components/hr/HrEmptyIllustration";
import { HrPageTitle } from "../../../../../components/hr/HrPageTitle";
import { cn } from "../../../../student-management/lib/utils";
import {
  crmService,
  type ActiveLeadIntakeProfile,
  type ExtendedLeadCard,
  type LeadFieldFilter,
} from "../../services/crmService";
import { LeadDetailDrawer } from "./LeadDetailDrawer";
import { LeadIntakeBuilderModal } from "./LeadIntakeBuilderModal";
import { LeadModuleSyncModal } from "./LeadModuleSyncModal";
import { LeadSheetCell, type CellDirection } from "./LeadSheetCell";
import { SocialPlatformIcon } from "./SocialPlatformIcon";
import {
  COLLECTION_STATUS_META,
  DEFAULT_HIDDEN_SYSTEM_COLUMNS,
  defaultBotQuestion,
  downloadLeadsExcel,
  FIELD_TYPE_META,
  isNameField,
  LEAD_STATUS_META,
  leadHasIntakeField,
  loadSheetLayout,
  PLATFORM_LABELS,
  saveSheetLayout,
  toIntakeFieldKey,
  type LeadAccountOption,
  type LeadSheetColumn,
  type LeadSocialPlatform,
} from "./leadSheetUtils";

interface LeadTableProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setShowCreateLeadModal: (show: boolean) => void;
  deleteLead: (id: string) => Promise<void> | void;
  handleGoToChat: (customerName: string, conversationId?: string, channel?: string, accountId?: string) => void;
  activeChannel: "all" | LeadSocialPlatform;
  accountId?: string;
  companyCode: string;
  branchId: string;
  enabledModules?: string[];
  accounts?: LeadAccountOption[];
  onSelectAccountScope?: (channel: "all" | LeadSocialPlatform, accountId?: string) => void;
  onActiveFieldsChange?: (fields: LeadIntakeField[]) => void;
  refreshToken?: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MIN_COL_WIDTH = 128;
const MAX_COL_WIDTH = 440;

const fieldInputClass =
  "h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary";
const secondaryBtnClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

const fieldTypeSelectOptions = LEAD_INTAKE_FIELD_TYPES.map(type => ({
  value: type,
  label: FIELD_TYPE_META[type].label,
}));
const collectionRowOptions = [
  { value: "", label: "Chưa cấu hình" },
  ...Object.entries(COLLECTION_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label })),
];
const statusRowOptions = Object.entries(LEAD_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label }));

interface PinnedFieldFilter {
  id: string;
  colKey: string;
  label: string;
  filterKey: string;
  value: string;
  valueLabel: string;
  mode: "exact" | "contains";
}

function getColumnFilterOptions(col: LeadSheetColumn): Array<{ value: string; label: string }> | null {
  if (col.key === "collectionStatus") {
    return Object.entries(COLLECTION_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label }));
  }
  if (col.key === "status") {
    return Object.entries(LEAD_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label }));
  }
  if (col.key === "sourceChannel") {
    return Object.entries(PLATFORM_LABELS).map(([key, label]) => ({ value: key, label }));
  }
  if (col.type === "checkbox") {
    return [
      { value: "Có", label: "Có / Đã chọn" },
      { value: "Không", label: "Không / Chưa chọn" },
    ];
  }
  if ((col.type === "single_select" || col.type === "multi_select") && col.options && col.options.length > 0) {
    return col.options.map(option => ({ value: option, label: option }));
  }
  return null;
}

function getColumnFilterSpec(col: LeadSheetColumn): { filterKey: string; mode: "exact" | "contains" } | null {
  if (col.kind === "intake" && col.answerKey) {
    return {
      filterKey: `answers.${col.answerKey}`,
      mode: col.type === "single_select" || col.type === "checkbox" ? "exact" : "contains",
    };
  }
  switch (col.key) {
    case "customerName":
    case "phone":
    case "email":
    case "company":
    case "productOfChoice":
      return { filterKey: col.key, mode: "contains" };
    case "value":
    case "status":
    case "collectionStatus":
    case "updatedAt":
      return { filterKey: col.key, mode: "exact" };
    case "sourceChannel":
      return { filterKey: "sourcePlatform", mode: "exact" };
    default:
      return null;
  }
}

function resolveFilterValueLabel(col: LeadSheetColumn, rawValue: string): string {
  const options = getColumnFilterOptions(col);
  const matched = options?.find(opt => opt.value === rawValue);
  if (matched) return matched.label;
  if (col.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [yyyy, mm, dd] = rawValue.split("-");
    return `${dd}/${mm}/${yyyy}`;
  }
  return rawValue;
}

const FieldTypeIcon: React.FC<{ type: LeadIntakeFieldType }> = ({ type }) => {
  const className = "size-3.5 shrink-0 text-on-surface-variant";
  switch (type) {
    case "phone":
      return <Phone aria-hidden="true" className={className} />;
    case "email":
      return <Mail aria-hidden="true" className={className} />;
    case "currency":
      return <DollarSign aria-hidden="true" className={className} />;
    case "number":
      return <Hash aria-hidden="true" className={className} />;
    case "date":
      return <Calendar aria-hidden="true" className={className} />;
    case "single_select":
    case "multi_select":
      return <List aria-hidden="true" className={className} />;
    case "checkbox":
      return <CheckSquare aria-hidden="true" className={className} />;
    case "long_text":
      return <AlignLeft aria-hidden="true" className={className} />;
    default:
      return <Type aria-hidden="true" className={className} />;
  }
};

function defaultWidthForType(type: LeadIntakeFieldType): number {
  if (type === "checkbox") return 152;
  if (type === "number" || type === "currency" || type === "date" || type === "phone") return 176;
  if (type === "single_select") return 192;
  if (type === "long_text" || type === "multi_select") return 240;
  return 204;
}

function getSystemSortKey(key: string): string | undefined {
  if (key === "customerName") return "customerName";
  if (key === "phone") return "phone";
  if (key === "email") return "email";
  if (key === "company") return "company";
  if (key === "sourceChannel") return "sourcePlatform";
  if (key === "value") return "value";
  if (key === "status") return "status";
  if (key === "collectionStatus") return "collectionStatus";
  if (key === "updatedAt") return "updatedAt";
  return undefined;
}

function readCellValue(lead: ExtendedLeadCard, col: LeadSheetColumn): string {
  if (col.kind === "intake") {
    if (!leadHasIntakeField(lead, col)) return "";
    return lead.answers?.[col.answerKey || col.key] || "";
  }
  switch (col.key) {
    case "customerName":
      return lead.customerName || "";
    case "phone":
      return lead.phone || "";
    case "email":
      return lead.email || "";
    case "company":
      return lead.company || "";
    case "productOfChoice":
      return lead.productOfChoice || "";
    case "value":
      return Number(lead.value) ? String(lead.value) : "";
    default:
      return "";
  }
}

export const LeadTable: React.FC<LeadTableProps> = ({
  searchQuery,
  setSearchQuery,
  setShowCreateLeadModal,
  deleteLead,
  handleGoToChat,
  activeChannel,
  accountId,
  companyCode,
  branchId,
  enabledModules,
  accounts = [],
  onSelectAccountScope,
  onActiveFieldsChange,
  refreshToken = 0,
}) => {
  const [leads, setLeads] = useState<ExtendedLeadCard[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [profiles, setProfiles] = useState<ActiveLeadIntakeProfile[]>([]);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const [builderState, setBuilderState] = useState<{
    open: boolean;
    addColumn: boolean;
    accountKey?: string;
    focusFieldKey?: string;
  }>({ open: false, addColumn: false });

  // Clean ErpModal for adding 1 column straight from the table header
  const [quickColModalOpen, setQuickColModalOpen] = useState(false);
  const [quickColLabel, setQuickColLabel] = useState("");
  const [quickColType, setQuickColType] = useState<LeadIntakeFieldType>("text");
  const [quickColOptions, setQuickColOptions] = useState("Lựa chọn 1, Lựa chọn 2");
  const [quickColRequired, setQuickColRequired] = useState(true);
  const [quickColBusy, setQuickColBusy] = useState(false);
  const [quickColError, setQuickColError] = useState("");

  const [deleteColumnTarget, setDeleteColumnTarget] = useState<LeadSheetColumn | null>(null);
  const [deletingColumn, setDeletingColumn] = useState(false);
  const [detailLead, setDetailLead] = useState<ExtendedLeadCard | null>(null);
  const [syncLead, setSyncLead] = useState<ExtendedLeadCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExtendedLeadCard | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const columnMenuRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);

  const effectiveScopeKey = useMemo(() => {
    if (activeChannel !== "all" && accountId) return `${activeChannel}:${accountId}`;
    return activeChannel;
  }, [activeChannel, accountId]);

  const [layoutPrefsByScope, setLayoutPrefsByScope] = useState<Record<string, ReturnType<typeof loadSheetLayout>>>({});
  const layoutPrefs = useMemo(
    () => layoutPrefsByScope[effectiveScopeKey] ?? loadSheetLayout(effectiveScopeKey),
    [layoutPrefsByScope, effectiveScopeKey],
  );
  const setLayoutPrefs = useCallback(
    (updater: React.SetStateAction<ReturnType<typeof loadSheetLayout>>) => {
      setLayoutPrefsByScope(current => {
        const base = current[effectiveScopeKey] ?? loadSheetLayout(effectiveScopeKey);
        const next = typeof updater === "function" ? updater(base) : updater;
        saveSheetLayout(effectiveScopeKey, next);
        return { ...current, [effectiveScopeKey]: next };
      });
    },
    [effectiveScopeKey],
  );

  const [filterState, setFilterState] = useState<{
    scopeKey: string;
    draftColKey: string;
    draftValue: string;
    pinned: PinnedFieldFilter[];
  }>({ scopeKey: "", draftColKey: "none", draftValue: "", pinned: [] });
  const draftFilterColKey = filterState.scopeKey === effectiveScopeKey ? filterState.draftColKey : "none";
  const draftFilterValue = filterState.scopeKey === effectiveScopeKey ? filterState.draftValue : "";
  const pinnedFilters = useMemo(
    () => (filterState.scopeKey === effectiveScopeKey ? filterState.pinned : []),
    [filterState, effectiveScopeKey],
  );
  const setDraftFilterColKey = useCallback(
    (nextColKey: string) => {
      setFilterState(current => ({
        scopeKey: effectiveScopeKey,
        draftColKey: nextColKey,
        draftValue: "",
        pinned: current.scopeKey === effectiveScopeKey ? current.pinned : [],
      }));
    },
    [effectiveScopeKey],
  );
  const setDraftFilterValue = useCallback(
    (nextValue: string) => {
      setFilterState(current => ({
        scopeKey: effectiveScopeKey,
        draftColKey: current.scopeKey === effectiveScopeKey ? current.draftColKey : "none",
        draftValue: nextValue,
        pinned: current.scopeKey === effectiveScopeKey ? current.pinned : [],
      }));
    },
    [effectiveScopeKey],
  );
  const setPinnedFilters = useCallback(
    (updater: React.SetStateAction<PinnedFieldFilter[]>) => {
      setFilterState(current => {
        const prevPinned = current.scopeKey === effectiveScopeKey ? current.pinned : [];
        return {
          scopeKey: effectiveScopeKey,
          draftColKey: current.scopeKey === effectiveScopeKey ? current.draftColKey : "none",
          draftValue: current.scopeKey === effectiveScopeKey ? current.draftValue : "",
          pinned: typeof updater === "function" ? updater(prevPinned) : updater,
        };
      });
    },
    [effectiveScopeKey],
  );

  const [activeCellState, setActiveCellState] = useState<{
    scopeKey: string;
    cell: { row: number; col: number } | null;
  }>({ scopeKey: "", cell: null });
  const activeCell = activeCellState.scopeKey === effectiveScopeKey ? activeCellState.cell : null;
  const setActiveCell = useCallback(
    (cell: { row: number; col: number } | null) => {
      setActiveCellState({ scopeKey: effectiveScopeKey, cell });
    },
    [effectiveScopeKey],
  );

  useEffect(() => {
    if (!columnMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !columnMenuRef.current?.contains(event.target)) {
        setColumnMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColumnMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [columnMenuOpen]);

  const sortParam = useMemo(() => `${sortField}:${sortDir}`, [sortField, sortDir]);

  const loadProfiles = useCallback(async () => {
    try {
      const activeProfiles = await crmService.getActiveLeadIntakeProfiles();
      setProfiles(activeProfiles);
    } catch {
      // Do not fail sheet rendering if optional profiles fail to load.
    }
  }, []);

  const activeAccount = useMemo(() => {
    if (activeChannel === "all" || !accountId) return null;
    return accounts.find(acc => acc.platform === activeChannel && acc.accountId === accountId) || null;
  }, [accounts, activeChannel, accountId]);

  const companyProfile = useMemo(
    () => profiles.find(profile => !profile.platform && !profile.accountId) || null,
    [profiles],
  );

  const scopedProfile = useMemo(() => {
    if (activeChannel === "all") return companyProfile;
    if (accountId) {
      const exact = profiles.find(profile => profile.platform === activeChannel && profile.accountId === accountId);
      if (exact) return exact;
    }
    return profiles.find(profile => profile.platform === activeChannel && profile.accountId === "default") || companyProfile;
  }, [profiles, activeChannel, accountId, companyProfile]);

  useEffect(() => {
    onActiveFieldsChange?.(scopedProfile?.fields || []);
  }, [scopedProfile, onActiveFieldsChange]);

  const allColumns = useMemo<LeadSheetColumn[]>(() => {
    const isScopedAccount = activeChannel !== "all" && Boolean(accountId);
    const intakeColumns: LeadSheetColumn[] = [];

    if (isScopedAccount) {
      const profileFields = scopedProfile?.fields || [];
      if (profileFields.length > 0) {
        for (const field of profileFields) {
          intakeColumns.push({
            key: `intake:${field.key}`,
            answerKey: field.key,
            label: field.label,
            type: field.type || "text",
            required: field.required,
            question: field.question,
            options: field.options,
            kind: "intake",
            platform: activeChannel,
            accountId,
            defaultWidth: defaultWidthForType(field.type || "text"),
            editable: true,
            sortable: true,
            sortKey: `answers.${field.key}`,
          });
        }
      } else {
        const seen = new Map<string, LeadIntakeField>();
        for (const lead of leads) {
          for (const field of lead.intakeFields || []) {
            if (!seen.has(field.key)) seen.set(field.key, field);
          }
        }
        for (const field of seen.values()) {
          intakeColumns.push({
            key: `intake:${field.key}`,
            answerKey: field.key,
            label: field.label,
            type: field.type || "text",
            required: field.required,
            question: field.question,
            options: field.options,
            kind: "intake",
            platform: activeChannel,
            accountId,
            defaultWidth: defaultWidthForType(field.type || "text"),
            editable: true,
            sortable: true,
            sortKey: `answers.${field.key}`,
          });
        }
      }
    } else {
      const seenKeys = new Set<string>();
      const sortedProfiles = [...profiles].sort((a, b) => Number(Boolean(a.platform)) - Number(Boolean(b.platform)));
      for (const profile of sortedProfiles) {
        if (activeChannel !== "all" && profile.platform && profile.platform !== activeChannel) continue;
        for (const field of profile.fields || []) {
          const colKey = profile.platform && profile.accountId
            ? `intake:${profile.platform}:${profile.accountId}:${field.key}`
            : `intake:${field.key}`;
          if (seenKeys.has(colKey)) continue;
          seenKeys.add(colKey);
          intakeColumns.push({
            key: colKey,
            answerKey: field.key,
            label: field.label,
            type: field.type || "text",
            required: field.required,
            question: field.question,
            options: field.options,
            kind: "intake",
            platform: profile.platform,
            accountId: profile.accountId === "default" ? undefined : profile.accountId,
            defaultWidth: defaultWidthForType(field.type || "text"),
            editable: true,
            sortable: true,
            sortKey: `answers.${field.key}`,
          });
        }
      }
      if (intakeColumns.length === 0) {
        const seenFallback = new Map<string, LeadIntakeField>();
        for (const lead of leads) {
          for (const field of lead.intakeFields || []) {
            if (!seenFallback.has(field.key)) seenFallback.set(field.key, field);
          }
        }
        for (const field of seenFallback.values()) {
          intakeColumns.push({
            key: `intake:${field.key}`,
            answerKey: field.key,
            label: field.label,
            type: field.type || "text",
            required: field.required,
            question: field.question,
            options: field.options,
            kind: "intake",
            defaultWidth: defaultWidthForType(field.type || "text"),
            editable: true,
            sortable: true,
            sortKey: `answers.${field.key}`,
          });
        }
      }
    }

    const hasCustomNameColumn = intakeColumns.some(col => isNameField({ key: col.answerKey || col.key, label: col.label }));
    const anchorNameCol: LeadSheetColumn[] = hasCustomNameColumn
      ? []
      : [{ key: "customerName", label: "Họ và tên", type: "text", kind: "system", defaultWidth: 204, editable: true, sortable: true, sortKey: "customerName" }];

    // Optional CRM metadata columns: off by default so user sees only the columns they defined.
    const optionalSystemColumns: LeadSheetColumn[] = [
      ...(hasCustomNameColumn
        ? [{ key: "customerName", label: "Tên hệ thống", type: "text" as LeadIntakeFieldType, kind: "system" as const, defaultWidth: 196, editable: true, sortable: true, sortKey: "customerName" }]
        : []),
      { key: "phone", label: "Số điện thoại", type: "phone", kind: "system", defaultWidth: 168, editable: true, sortable: true, sortKey: "phone" },
      ...(isScopedAccount
        ? []
        : [{ key: "sourceChannel", label: "Kênh / Tài khoản", type: "text" as LeadIntakeFieldType, kind: "system" as const, defaultWidth: 184, editable: false, sortable: true, sortKey: "sourcePlatform" }]),
      { key: "collectionStatus", label: "Tình trạng Bot", type: "single_select", kind: "system", defaultWidth: 172, editable: true, sortable: true, sortKey: "collectionStatus" },
      { key: "status", label: "Trạng thái chốt", type: "single_select", kind: "system", defaultWidth: 168, editable: true, sortable: true, sortKey: "status" },
      { key: "value", label: "Giá trị dự kiến", type: "currency", kind: "system", defaultWidth: 168, editable: true, sortable: true, sortKey: "value" },
      { key: "email", label: "Email", type: "email", kind: "system", defaultWidth: 196, editable: true, sortable: true, sortKey: "email" },
      { key: "company", label: "Doanh nghiệp", type: "text", kind: "system", defaultWidth: 184, editable: true, sortable: true, sortKey: "company" },
      { key: "updatedAt", label: "Cập nhật", type: "date", kind: "system", defaultWidth: 152, editable: false, sortable: true, sortKey: "updatedAt" },
    ];

    return [...anchorNameCol, ...intakeColumns, ...optionalSystemColumns];
  }, [activeChannel, accountId, scopedProfile, profiles, leads]);

  const activeDraftFilterCol = useMemo(
    () => (draftFilterColKey !== "none" ? allColumns.find(col => col.key === draftFilterColKey) || null : null),
    [allColumns, draftFilterColKey],
  );

  const draftFilterOptions = useMemo(
    () => (activeDraftFilterCol ? getColumnFilterOptions(activeDraftFilterCol) : null),
    [activeDraftFilterCol],
  );

  const effectiveFieldFilters = useMemo<LeadFieldFilter[]>(() => {
    const map = new Map<string, LeadFieldFilter>();
    for (const chip of pinnedFilters) {
      map.set(chip.colKey, { key: chip.filterKey, value: chip.value, mode: chip.mode });
    }
    if (activeDraftFilterCol && draftFilterValue.trim()) {
      const spec = getColumnFilterSpec(activeDraftFilterCol);
      if (spec) {
        map.set(activeDraftFilterCol.key, {
          key: spec.filterKey,
          value: draftFilterValue.trim(),
          mode: spec.mode,
        });
      }
    }
    return Array.from(map.values());
  }, [pinnedFilters, activeDraftFilterCol, draftFilterValue]);

  const filterFieldSelectOptions = useMemo(() => {
    const seenKeys = new Set<string>();
    const options: Array<{ value: string; label: string }> = [{ value: "none", label: "Lọc theo trường…" }];
    for (const col of allColumns) {
      const spec = getColumnFilterSpec(col);
      if (!spec || seenKeys.has(col.key)) continue;
      seenKeys.add(col.key);
      options.push({ value: col.key, label: col.label });
    }
    return options;
  }, [allColumns]);

  const sortSelectOptions = useMemo(() => {
    const seen = new Set<string>(["updatedAt:desc"]);
    const options: Array<{ value: string; label: string }> = [
      { value: "updatedAt:desc", label: "Sắp xếp: Mới cập nhật" },
    ];
    for (const col of allColumns) {
      const sortKey = col.sortKey || getSystemSortKey(col.key);
      if (!sortKey) continue;
      const ascVal = `${sortKey}:asc`;
      const descVal = `${sortKey}:desc`;
      const isNum = col.type === "number" || col.type === "currency";
      const isDate = col.type === "date";
      if (!seen.has(ascVal)) {
        seen.add(ascVal);
        options.push({
          value: ascVal,
          label: isNum ? `${col.label} (Thấp → Cao)` : isDate ? `${col.label} (Cũ nhất)` : `${col.label} (A → Z)`,
        });
      }
      if (!seen.has(descVal)) {
        seen.add(descVal);
        options.push({
          value: descVal,
          label: isNum ? `${col.label} (Cao → Thấp)` : isDate ? `${col.label} (Mới nhất)` : `${col.label} (Z → A)`,
        });
      }
    }
    return options;
  }, [allColumns]);

  const hasCustomSort = sortField !== "updatedAt" || sortDir !== "desc";
  const hasActiveFilters = Boolean(searchQuery.trim() || effectiveFieldFilters.length > 0 || hasCustomSort);

  const filterSignature = useMemo(
    () => `${effectiveScopeKey}|${searchQuery}|${JSON.stringify(effectiveFieldFilters)}|${sortParam}`,
    [effectiveScopeKey, searchQuery, effectiveFieldFilters, sortParam],
  );
  const [pageState, setPageState] = useState<{ sig: string; value: number }>({ sig: "", value: 1 });
  const page = pageState.sig === filterSignature ? pageState.value : 1;
  const setPage = useCallback(
    (next: number | ((current: number) => number)) => {
      setPageState(current => {
        const base = current.sig === filterSignature ? current.value : 1;
        return { sig: filterSignature, value: typeof next === "function" ? next(base) : next };
      });
    },
    [filterSignature],
  );

  const loadLeads = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await crmService.getLeadPage({
        channel: activeChannel,
        accountId,
        search: searchQuery,
        ...(effectiveFieldFilters.length > 0 ? { fieldFilters: effectiveFieldFilters } : {}),
        sort: sortParam,
        page,
        limit: pageSize,
      });
      if (seq !== requestSeqRef.current) return;
      setLeads(Array.isArray(result.data) ? result.data : []);
      setTotalItems(result.total);
    } catch (cause) {
      if (seq !== requestSeqRef.current) return;
      setError(cause instanceof Error ? cause.message : "Không thể tải bảng Lead Sheet.");
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [activeChannel, accountId, searchQuery, effectiveFieldFilters, sortParam, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadProfiles();
    });
    return () => { cancelled = true; };
  }, [loadProfiles, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadLeads();
    });
    return () => { cancelled = true; };
  }, [loadLeads, refreshToken]);

  const visibleColumns = useMemo(() => {
    const hidden = new Set(layoutPrefs.hiddenKeys);
    const hasCustomNameColumn = allColumns.some(col => col.kind === "intake" && isNameField({ key: col.answerKey || col.key, label: col.label }));
    const filtered = allColumns.filter(col => {
      if (col.key === "customerName" && hasCustomNameColumn) {
        // Hide duplicate system customerName by default when user already added a name field
        return layoutPrefs.hiddenKeys.includes("showSystemName");
      }
      return !hidden.has(col.key);
    });
    return filtered.length > 0 ? filtered : allColumns.slice(0, 1);
  }, [allColumns, layoutPrefs.hiddenKeys]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function getColumnWidth(col: LeadSheetColumn): number {
    const saved = layoutPrefs.widths[col.key];
    return typeof saved === "number" && saved >= MIN_COL_WIDTH && saved <= MAX_COL_WIDTH ? saved : col.defaultWidth;
  }

  function startResize(event: React.MouseEvent, col: LeadSheetColumn) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = getColumnWidth(col);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(startWidth + (moveEvent.clientX - startX))));
      setLayoutPrefs(current => ({
        ...current,
        widths: { ...current.widths, [col.key]: nextWidth },
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function nudgeColumnWidth(col: LeadSheetColumn, delta: number) {
    const nextWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, getColumnWidth(col) + delta));
    setLayoutPrefs(current => ({
      ...current,
      widths: { ...current.widths, [col.key]: nextWidth },
    }));
  }

  function toggleSort(col: LeadSheetColumn) {
    const key = col.sortKey || getSystemSortKey(col.key);
    if (!key) return;
    if (sortField === key) {
      setSortDir(current => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(key);
      setSortDir(key === "customerName" ? "asc" : "desc");
    }
    setPage(1);
  }

  function toggleColumnVisibility(colKey: string) {
    setLayoutPrefs(current => {
      const exists = current.hiddenKeys.includes(colKey);
      if (!exists && visibleColumns.length <= 1) return current;
      return {
        ...current,
        hiddenKeys: exists
          ? current.hiddenKeys.filter(k => k !== colKey)
          : [...current.hiddenKeys, colKey],
      };
    });
  }

  function resetLayout() {
    setLayoutPrefs({ widths: {}, hiddenKeys: [...DEFAULT_HIDDEN_SYSTEM_COLUMNS] });
  }

  const navigateCell = useCallback((rowIndex: number, colIndex: number, direction: CellDirection) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;
    if (direction === "up") nextRow = Math.max(0, rowIndex - 1);
    else if (direction === "down") nextRow = Math.min(leads.length - 1, rowIndex + 1);
    else if (direction === "left") nextCol = Math.max(0, colIndex - 1);
    else if (direction === "right") nextCol = Math.min(visibleColumns.length - 1, colIndex + 1);

    setActiveCell({ row: nextRow, col: nextCol });
    requestAnimationFrame(() => {
      const target = gridContainerRef.current?.querySelector<HTMLElement>(`[data-sheet-cell="${nextRow}:${nextCol}"]`);
      target?.focus();
    });
  }, [leads.length, visibleColumns.length, setActiveCell]);

  async function saveCell(lead: ExtendedLeadCard, col: LeadSheetColumn, nextValue: string) {
    try {
      let updated: ExtendedLeadCard;
      if (col.kind === "intake") {
        const targetKey = col.answerKey || col.key;
        const nextAnswers = { ...(lead.answers || {}) };
        if (nextValue) nextAnswers[targetKey] = nextValue;
        else delete nextAnswers[targetKey];
        updated = await crmService.updateLead(lead.id, { answers: nextAnswers });
      } else if (col.key === "customerName") {
        if (!nextValue.trim()) {
          toast.error("Họ tên khách hàng không được để trống.");
          throw new Error("empty customerName");
        }
        updated = await crmService.updateLead(lead.id, { customerName: nextValue.trim() });
      } else if (col.key === "phone") {
        updated = await crmService.updateLead(lead.id, { phone: nextValue.trim() });
      } else if (col.key === "email") {
        updated = await crmService.updateLead(lead.id, { email: nextValue.trim() });
      } else if (col.key === "company") {
        updated = await crmService.updateLead(lead.id, { company: nextValue.trim() });
      } else if (col.key === "value") {
        const numeric = Number(nextValue.replace(/[\s,]/g, "")) || 0;
        if (numeric < 0) {
          toast.error("Giá trị phải là số không âm.");
          throw new Error("negative value");
        }
        updated = await crmService.updateLead(lead.id, { value: numeric });
      } else {
        return;
      }

      setLeads(current => current.map(item => (item.id === lead.id ? updated : item)));
      if (detailLead?.id === lead.id) setDetailLead(updated);
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message !== "empty customerName" && cause.message !== "negative value"
        ? cause.message
        : "Không thể lưu thay đổi.");
      throw cause;
    }
  }

  async function handleSelectEnumUpdate(
    lead: ExtendedLeadCard,
    patch: Partial<Pick<ExtendedLeadCard, "status" | "collectionStatus">>,
  ) {
    try {
      const updated = await crmService.updateLead(lead.id, patch);
      setLeads(current => current.map(item => (item.id === lead.id ? updated : item)));
      if (detailLead?.id === lead.id) setDetailLead(updated);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái.");
    }
  }

  function handlePinCurrentFilter() {
    if (!activeDraftFilterCol || !draftFilterValue.trim()) return;
    const spec = getColumnFilterSpec(activeDraftFilterCol);
    if (!spec) return;
    const rawVal = draftFilterValue.trim();
    const chip: PinnedFieldFilter = {
      id: `${activeDraftFilterCol.key}:${spec.filterKey}`,
      colKey: activeDraftFilterCol.key,
      label: activeDraftFilterCol.label,
      filterKey: spec.filterKey,
      value: rawVal,
      valueLabel: resolveFilterValueLabel(activeDraftFilterCol, rawVal),
      mode: spec.mode,
    };
    setPinnedFilters(current => [...current.filter(item => item.colKey !== chip.colKey), chip]);
    setDraftFilterColKey("none");
    setDraftFilterValue("");
  }

  function removePinnedFilter(chipId: string) {
    setPinnedFilters(current => current.filter(item => item.id !== chipId));
  }

  function handleSortSelectChange(nextSort: string) {
    const sepIndex = nextSort.lastIndexOf(":");
    if (sepIndex <= 0) return;
    const nextField = nextSort.slice(0, sepIndex);
    const nextDir = nextSort.slice(sepIndex + 1);
    if (nextDir !== "asc" && nextDir !== "desc") return;
    setSortField(nextField);
    setSortDir(nextDir);
    setPage(1);
  }

  function handleResetAllFilters() {
    setSearchQuery("");
    setDraftFilterColKey("none");
    setDraftFilterValue("");
    setPinnedFilters([]);
    setSortField("updatedAt");
    setSortDir("desc");
    setPage(1);
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await crmService.getAllLeadRows({
        channel: activeChannel,
        accountId,
        search: searchQuery,
        ...(effectiveFieldFilters.length > 0 ? { fieldFilters: effectiveFieldFilters } : {}),
        sort: sortParam,
      });
      await downloadLeadsExcel(rows, visibleColumns);
      toast.success(`Đã xuất ${rows.length} Lead ra tệp Excel.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Không thể xuất tệp Excel.");
    } finally {
      setExporting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteLead(deleteTarget.id));
      setLeads(current => current.filter(item => item.id !== deleteTarget.id));
      setTotalItems(current => Math.max(0, current - 1));
      if (detailLead?.id === deleteTarget.id) setDetailLead(null);
      setDeleteTarget(null);
    } catch {
      toast.error("Không thể xóa Lead.");
    } finally {
      setDeleting(false);
    }
  }

  function openQuickAddColumnModal() {
    setQuickColLabel("");
    setQuickColType("text");
    setQuickColOptions("Lựa chọn 1, Lựa chọn 2");
    setQuickColRequired(true);
    setQuickColError("");
    setQuickColModalOpen(true);
  }

  async function handleQuickAddColumn(event: React.FormEvent) {
    event.preventDefault();
    const label = quickColLabel.trim();
    if (!label || quickColBusy) {
      if (!label) setQuickColError("Nhập tên cột mới.");
      return;
    }
    const baseProfile = scopedProfile;
    const existingFields = baseProfile?.fields || [];
    if (existingFields.length >= 30) {
      setQuickColError("Mỗi Sheet hỗ trợ tối đa 30 cột tùy chỉnh.");
      return;
    }
    const usedKeys = new Set(existingFields.map(field => field.key));
    const key = toIntakeFieldKey(label, usedKeys);
    const options = (quickColType === "single_select" || quickColType === "multi_select")
      ? quickColOptions.split(",").map(opt => opt.trim()).filter(Boolean)
      : [];
    if ((quickColType === "single_select" || quickColType === "multi_select") && options.length < 2) {
      setQuickColError("Cột lựa chọn cần ít nhất 2 lựa chọn (ngăn cách bằng dấu phẩy).");
      return;
    }

    const nextField: LeadIntakeField = {
      key,
      label: label.slice(0, 100),
      question: defaultBotQuestion(label, quickColType).slice(0, 300),
      type: quickColType,
      required: quickColRequired,
      options: options.slice(0, 30),
    };

    setQuickColBusy(true);
    setQuickColError("");
    try {
      await crmService.saveAndActivateLeadIntakeProfile({
        ...(activeAccount ? { platform: activeAccount.platform, accountId: activeAccount.accountId } : {}),
        goal: baseProfile?.goal || "Thu thập thông tin khách hàng tiềm năng",
        completionMessage: baseProfile?.completionMessage || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.",
        fields: [...existingFields, nextField],
        sourceDocumentIds: baseProfile?.sourceDocumentIds || [],
      });
      setQuickColModalOpen(false);
      toast.success(`Đã thêm cột "${label}" vào Lead Sheet${quickColRequired ? " và Chatbot" : ""}.`);
      await loadProfiles();
      void loadLeads();
    } catch (cause) {
      setQuickColError(cause instanceof Error ? cause.message : "Không thể thêm cột mới.");
    } finally {
      setQuickColBusy(false);
    }
  }

  async function handleConfirmDeleteColumn() {
    if (!deleteColumnTarget || deletingColumn || !deleteColumnTarget.answerKey) return;
    const targetPlatform = deleteColumnTarget.platform;
    const targetAccountId = deleteColumnTarget.accountId;
    const targetProfile = targetPlatform && targetAccountId
      ? profiles.find(p => p.platform === targetPlatform && p.accountId === targetAccountId) || scopedProfile
      : companyProfile || scopedProfile;
    if (!targetProfile) {
      setDeleteColumnTarget(null);
      return;
    }

    setDeletingColumn(true);
    try {
      const remaining = targetProfile.fields.filter(field => field.key !== deleteColumnTarget.answerKey);
      const scope = targetPlatform && targetAccountId
        ? { platform: targetPlatform, accountId: targetAccountId }
        : undefined;
      if (remaining.length === 0) {
        await crmService.archiveLeadIntakeProfile(scope);
      } else {
        await crmService.saveAndActivateLeadIntakeProfile({
          ...scope,
          goal: targetProfile.goal || "Thu thập thông tin khách hàng tiềm năng",
          completionMessage: targetProfile.completionMessage || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.",
          fields: remaining,
          sourceDocumentIds: targetProfile.sourceDocumentIds || [],
        });
      }
      toast.success(`Đã xóa cột "${deleteColumnTarget.label}" khỏi Sheet.`);
      setDeleteColumnTarget(null);
      await loadProfiles();
      void loadLeads();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Không thể xóa cột.");
    } finally {
      setDeletingColumn(false);
    }
  }

  const builderInitialAccountKey = activeAccount
    ? `${activeAccount.platform}:${activeAccount.accountId}`
    : "company";

  const customColumns = allColumns.filter(col => col.kind === "intake");
  const systemColumns = allColumns.filter(col => col.kind === "system");
  const intakeColumnCount = visibleColumns.filter(col => col.kind === "intake").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-surface p-3 sm:p-4">
      {/* Page Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
        <HrPageTitle>Bảng dữ liệu Lead</HrPageTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ErpRefreshButton
            loading={loading}
            onClick={() => {
              void loadProfiles();
              void loadLeads();
            }}
          />
          <button
            type="button"
            onClick={() => setBuilderState({ open: true, addColumn: false, accountKey: builderInitialAccountKey })}
            className={secondaryBtnClass}
          >
            <Settings2 aria-hidden="true" className="size-3.5 text-primary" />
            Cấu hình cột & Chatbot
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className={secondaryBtnClass}
          >
            {exporting ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Download aria-hidden="true" className="size-3.5" />}
            Xuất Excel
          </button>
          <button type="button" onClick={() => setShowCreateLeadModal(true)} className={primaryCreateButtonClass}>
            <Plus aria-hidden="true" className="size-4" />
            Thêm Lead
          </button>
        </div>
      </div>

      {/* Standard ERP Filter & Sort Toolbar */}
      <TableFilterToolbar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Tìm kiếm trong bảng Lead…",
          ariaLabel: "Tìm Lead theo tên, số điện thoại, nội dung thu thập",
        }}
        totalCount={totalItems}
        countLabel="Lead"
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetAllFilters}
      >
        <div className="w-44">
          <StyledSelect
            ariaLabel="Chọn trường thông tin để lọc"
            value={draftFilterColKey}
            options={filterFieldSelectOptions}
            onChange={(next) => {
              setDraftFilterColKey(next);
              setDraftFilterValue("");
            }}
            className="h-9 rounded-xl text-xs"
          />
        </div>

        {activeDraftFilterCol && (
          <div className="flex items-center gap-1.5">
            {draftFilterOptions ? (
              <div className="w-44">
                <StyledSelect
                  ariaLabel={`Giá trị lọc ${activeDraftFilterCol.label}`}
                  value={draftFilterValue || "all"}
                  options={[{ value: "all", label: "Chọn giá trị…" }, ...draftFilterOptions]}
                  onChange={(next) => setDraftFilterValue(next === "all" ? "" : next)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            ) : activeDraftFilterCol.type === "date" ? (
              <DateInput24
                ariaLabel={`Giá trị lọc ${activeDraftFilterCol.label}`}
                value={draftFilterValue}
                onChange={setDraftFilterValue}
                className="h-9 w-40 rounded-xl text-xs"
              />
            ) : (
              <input
                type="text"
                inputMode={activeDraftFilterCol.type === "number" || activeDraftFilterCol.type === "currency" ? "numeric" : undefined}
                aria-label={`Giá trị lọc ${activeDraftFilterCol.label}`}
                value={draftFilterValue}
                onChange={(event) => setDraftFilterValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && draftFilterValue.trim()) {
                    event.preventDefault();
                    handlePinCurrentFilter();
                  }
                }}
                placeholder={`Lọc ${activeDraftFilterCol.label.toLowerCase()}…`}
                className="h-9 w-44 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary"
              />
            )}

            {draftFilterValue.trim() && (
              <button
                type="button"
                onClick={handlePinCurrentFilter}
                aria-label="Ghim điều kiện lọc"
                title="Ghim điều kiện này để lọc kết hợp thêm trường khác"
                className={secondaryBtnClass}
              >
                <Plus aria-hidden="true" className="size-3.5 text-primary" />
                Ghim lọc
              </button>
            )}
          </div>
        )}

        <div className="w-48">
          <StyledSelect
            ariaLabel="Sắp xếp danh sách Lead theo trường"
            value={sortParam}
            options={sortSelectOptions}
            onChange={handleSortSelectChange}
            className="h-9 rounded-xl text-xs"
          />
        </div>

        <div ref={columnMenuRef} className="relative">
          <button
            type="button"
            aria-expanded={columnMenuOpen}
            aria-haspopup="menu"
            onClick={() => setColumnMenuOpen(current => !current)}
            className={secondaryBtnClass}
          >
            <Columns3 aria-hidden="true" className="size-3.5 text-on-surface-variant" />
            Cột hiển thị ({visibleColumns.length})
          </button>

          {columnMenuOpen && (
            <div
              role="menu"
              aria-label="Tùy chỉnh hiển thị cột Sheet"
              className="absolute left-0 z-30 mt-1.5 w-72 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-lg sm:left-auto sm:right-0"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-on-surface">Ẩn / hiện cột trên Sheet</span>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="text-xs text-primary hover:underline focus-visible:outline-1 focus-visible:outline-primary"
                >
                  Mặc định
                </button>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {customColumns.length > 0 && (
                  <>
                    <p className="px-2 py-1 text-xs font-medium text-on-surface-variant">Cột bạn đã tạo</p>
                    {customColumns.map(col => {
                      const visible = !layoutPrefs.hiddenKeys.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-container-low"
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() => toggleColumnVisibility(col.key)}
                            className="size-3.5 accent-primary"
                          />
                          <span className="min-w-0 flex-1 truncate text-on-surface">{col.label}</span>
                        </label>
                      );
                    })}
                  </>
                )}

                <p className="mt-1 border-t border-outline-variant px-2 pt-2 pb-1 text-xs font-medium text-on-surface-variant">
                  Cột hệ thống (tùy chọn bật thêm)
                </p>
                {systemColumns.map(col => {
                  const isVisible = visibleColumns.some(v => v.key === col.key);
                  return (
                    <label
                      key={col.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-container-low"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-on-surface">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </TableFilterToolbar>

      {pinnedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5" aria-label="Điều kiện lọc đang áp dụng">
          {pinnedFilters.map(chip => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-on-surface"
            >
              <span className="font-medium text-on-surface-variant">{chip.label}:</span>
              <span className="font-medium text-primary">{chip.valueLabel}</span>
              <button
                type="button"
                onClick={() => removePinnedFilter(chip.id)}
                aria-label={`Bỏ lọc ${chip.label}`}
                className="inline-flex size-4 items-center justify-center rounded text-on-surface-variant hover:bg-primary/15 hover:text-on-surface focus-visible:outline-1 focus-visible:outline-primary"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Worksheet Tabs & Spreadsheet Grid */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xs">
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-3 pt-2">
            <div role="tablist" aria-label="Sheet theo tài khoản Chatbot" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0">
              <button
                type="button"
                role="tab"
                aria-selected={activeChannel === "all"}
                onClick={() => onSelectAccountScope?.("all", undefined)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-1 focus-visible:outline-primary",
                  activeChannel === "all"
                    ? "border-outline-variant bg-surface-container-lowest text-primary"
                    : "border-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                )}
              >
                <Table2 aria-hidden="true" className="size-3.5" />
                <span>Tất cả Lead</span>
              </button>

              {accounts.map(acc => {
                const selected = activeChannel === acc.platform && accountId === acc.accountId;
                const hasProfile = profiles.some(profile => profile.platform === acc.platform && profile.accountId === acc.accountId);
                return (
                  <button
                    key={`${acc.platform}:${acc.accountId}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onSelectAccountScope?.(acc.platform, acc.accountId)}
                    className={cn(
                      "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-1 focus-visible:outline-primary",
                      selected
                        ? "border-outline-variant bg-surface-container-lowest text-primary"
                        : "border-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                    )}
                  >
                    <SocialPlatformIcon platform={acc.platform} className="size-3.5 shrink-0" />
                    <span className="max-w-44 truncate">{acc.displayName}</span>
                    {hasProfile && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Đã bật bộ cột Chatbot" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-2 pb-1.5 text-xs text-on-surface-variant">
              <span className="tabular-nums">{intakeColumnCount} cột</span>
              <button
                type="button"
                onClick={() => setBuilderState({ open: true, addColumn: true, accountKey: builderInitialAccountKey })}
                className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/15 focus-visible:outline-1 focus-visible:outline-primary"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm cột Bot
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center justify-between gap-2 border-b border-error/30 bg-error-container px-4 py-2.5 text-xs text-on-error-container">
            <div className="flex items-center gap-2">
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadLeads()}
              className="rounded border border-current px-2.5 py-1 text-xs font-medium hover:opacity-80"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Spreadsheet Grid */}
        <div ref={gridContainerRef} className="relative overflow-x-auto bg-surface-container-lowest">
          <table className="w-max min-w-full border-collapse text-left text-sm text-on-surface">
            <thead className="sticky top-0 z-20 bg-surface-container-low text-xs font-medium text-on-surface-variant">
              <tr className="border-b border-outline-variant">
                <th
                  scope="col"
                  style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                  className="sticky left-0 z-30 w-12 border-r border-outline-variant bg-surface-container-low px-2 py-2.5 text-center font-medium tabular-nums"
                >
                  #
                </th>

                {visibleColumns.map((col, colIdx) => {
                  const width = getColumnWidth(col);
                  const isStickyFirst = colIdx === 0;
                  const sortKey = col.sortKey || getSystemSortKey(col.key);
                  const isSorted = Boolean(sortKey && sortField === sortKey);
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={{ width, minWidth: width }}
                      className={cn(
                        "group/col relative select-none border-r border-outline-variant bg-surface-container-low px-3 py-2 text-left font-medium",
                        isStickyFirst && "sticky left-12 z-30 shadow-xs",
                      )}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <FieldTypeIcon type={col.type} />
                        {sortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className="inline-flex min-w-0 flex-1 items-center gap-1 text-left font-medium text-on-surface hover:text-primary focus-visible:outline-1 focus-visible:outline-primary"
                          >
                            <span>{col.label}</span>
                            {isSorted ? (
                              sortDir === "asc"
                                ? <ArrowUp aria-hidden="true" className="size-3 shrink-0 text-primary" />
                                : <ArrowDown aria-hidden="true" className="size-3 shrink-0 text-primary" />
                            ) : (
                              <ArrowUpDown aria-hidden="true" className="size-3 shrink-0 opacity-45" />
                            )}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 font-medium text-on-surface" title={col.label}>
                            {col.label}
                          </span>
                        )}

                        {col.kind === "intake" && col.answerKey && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              aria-label={`Sửa cột ${col.label}`}
                              title={`Sửa cột ${col.label}`}
                              onClick={() => {
                                const targetAccountKey = col.platform && col.accountId ? `${col.platform}:${col.accountId}` : "company";
                                setBuilderState({ open: true, addColumn: false, accountKey: targetAccountKey, focusFieldKey: col.answerKey });
                              }}
                              className="inline-flex size-5 items-center justify-center rounded text-on-surface-variant opacity-70 hover:bg-surface-container hover:text-primary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-primary"
                            >
                              <Pencil aria-hidden="true" className="size-3" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Xóa cột ${col.label}`}
                              title={`Xóa cột ${col.label}`}
                              onClick={() => setDeleteColumnTarget(col)}
                              className="inline-flex size-5 items-center justify-center rounded text-on-surface-variant opacity-70 hover:bg-error-container hover:text-error hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-primary"
                            >
                              <Trash2 aria-hidden="true" className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Accessible Column Resize Handle */}
                      <div
                        role="separator"
                        tabIndex={0}
                        aria-orientation="vertical"
                        aria-label={`Đổi độ rộng cột ${col.label}`}
                        aria-valuemin={MIN_COL_WIDTH}
                        aria-valuemax={MAX_COL_WIDTH}
                        aria-valuenow={width}
                        onMouseDown={(event) => startResize(event, col)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowLeft") { event.preventDefault(); nudgeColumnWidth(col, -16); }
                          if (event.key === "ArrowRight") { event.preventDefault(); nudgeColumnWidth(col, 16); }
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none"
                      />
                    </th>
                  );
                })}

                <th scope="col" className="min-w-36 border-r border-outline-variant bg-surface-container-low px-2.5 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={openQuickAddColumnModal}
                    className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-1 focus-visible:outline-primary"
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Thêm cột
                  </button>
                </th>

                <th
                  scope="col"
                  style={{ width: 112, minWidth: 112, maxWidth: 112 }}
                  className="sticky right-0 z-30 w-28 border-l border-outline-variant bg-surface-container-low px-2.5 py-2 text-center font-medium shadow-xs"
                >
                  Thao tác
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant text-sm font-normal">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 3} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
                      <span>Đang tải dữ liệu Lead Sheet…</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 3} className="px-6 py-10 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-pretty">
                      <HrEmptyIllustration kind={hasActiveFilters ? "search" : "task"} />
                      <h4 className="text-sm font-semibold text-on-surface text-balance">
                        {hasActiveFilters ? "Không tìm thấy Lead phù hợp" : "Chưa có dữ liệu Lead"}
                      </h4>
                      <p className="text-xs text-on-surface-variant text-pretty">
                        {hasActiveFilters
                          ? "Thử thay đổi bộ lọc hoặc đặt lại để xem toàn bộ danh sách."
                          : "Dữ liệu khách từ Chatbot hoặc Lead bạn tạo qua + Thêm Lead sẽ hiển thị tại đây."}
                      </p>
                      <button
                        type="button"
                        onClick={() => (hasActiveFilters ? handleResetAllFilters() : setShowCreateLeadModal(true))}
                        className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary hover:text-on-primary focus-visible:outline-1 focus-visible:outline-primary"
                      >
                        {hasActiveFilters ? "Đặt lại bộ lọc" : "Tạo Lead mới"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead, rowIndex) => {
                  const rowNumber = (page - 1) * pageSize + rowIndex + 1;
                  return (
                    <tr key={lead.id} className="group/row transition-colors hover:bg-surface-container-low/65">
                      <td style={{ width: 48, minWidth: 48, maxWidth: 48 }} className="sticky left-0 z-10 w-12 border-r border-outline-variant bg-surface-container-lowest px-1 py-1 text-center text-xs tabular-nums text-on-surface-variant group-hover/row:bg-surface-container-low">
                        <button
                          type="button"
                          onClick={() => setDetailLead(lead)}
                          aria-label={`Mở chi tiết Lead ${lead.customerName}`}
                          title="Mở bảng chi tiết Lead"
                          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-primary/10 hover:text-primary focus-visible:outline-1 focus-visible:outline-primary"
                        >
                          <span className="group-hover/row:hidden">{rowNumber}</span>
                          <PanelRightOpen aria-hidden="true" className="hidden size-3.5 group-hover/row:block" />
                        </button>
                      </td>

                      {visibleColumns.map((col, colIndex) => {
                        const width = getColumnWidth(col);
                        const isStickyFirst = colIndex === 0;
                        const cellStyle = { width, minWidth: width };
                        const cellId = `${rowIndex}:${colIndex}`;
                        const isSelected = activeCell?.row === rowIndex && activeCell?.col === colIndex;

                        if (col.key === "sourceChannel") {
                          const platform = lead.sourcePlatform as LeadSocialPlatform | undefined;
                          const matchedAccount = platform && lead.sourceAccountId
                            ? accounts.find(acc => acc.platform === platform && acc.accountId === lead.sourceAccountId)
                            : null;
                          return (
                            <td key={col.key} style={cellStyle} className="border-r border-outline-variant px-2.5 py-1.5 align-middle">
                              {platform ? (
                                <div className="flex min-w-0 items-center gap-1.5 text-xs text-on-surface">
                                  <SocialPlatformIcon platform={platform} className="size-3.5 shrink-0" />
                                  <span className="truncate">
                                    {matchedAccount?.displayName || lead.sourceAccountId || PLATFORM_LABELS[platform]}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-on-surface-variant">Thủ công</span>
                              )}
                            </td>
                          );
                        }

                        if (col.key === "collectionStatus") {
                          return (
                            <td key={col.key} style={cellStyle} className="border-r border-outline-variant px-1.5 py-1 align-middle">
                              <StyledSelect
                                ariaLabel={`Tình trạng thu thập của ${lead.customerName}`}
                                value={lead.collectionStatus || ""}
                                options={collectionRowOptions}
                                onChange={(nextVal) => {
                                  if (!nextVal) return;
                                  void handleSelectEnumUpdate(lead, { collectionStatus: nextVal as LeadCollectionStatus });
                                }}
                                className="h-8 rounded-lg px-2 text-xs"
                              />
                            </td>
                          );
                        }

                        if (col.key === "status") {
                          return (
                            <td key={col.key} style={cellStyle} className="border-r border-outline-variant px-1.5 py-1 align-middle">
                              <StyledSelect
                                ariaLabel={`Trạng thái xử lý của ${lead.customerName}`}
                                value={lead.status}
                                options={statusRowOptions}
                                onChange={(nextVal) => {
                                  void handleSelectEnumUpdate(lead, { status: nextVal as ExtendedLeadCard["status"] });
                                }}
                                className="h-8 rounded-lg px-2 text-xs"
                              />
                            </td>
                          );
                        }

                        if (col.key === "updatedAt") {
                          return (
                            <td key={col.key} style={cellStyle} className="border-r border-outline-variant px-2.5 py-1.5 align-middle text-xs tabular-nums text-on-surface-variant">
                              <span className="block truncate">{lead.lastInteractionTime || "—"}</span>
                            </td>
                          );
                        }

                        const intakeApplicable = col.kind !== "intake" || activeChannel !== "all" || leadHasIntakeField(lead, col);
                        const cellValue = readCellValue(lead, col);

                        return (
                          <td
                            key={col.key}
                            style={cellStyle}
                            className={cn(
                              "border-r border-outline-variant p-0 align-middle",
                              isStickyFirst && "sticky left-12 z-10 bg-surface-container-lowest shadow-xs group-hover/row:bg-surface-container-low",
                              !intakeApplicable && "bg-surface-container-low/40",
                            )}
                          >
                            {intakeApplicable ? (
                              <LeadSheetCell
                                cellId={cellId}
                                label={col.label}
                                value={cellValue}
                                type={col.type}
                                options={col.options}
                                editable={col.editable}
                                isSelected={isSelected}
                                onSelect={() => setActiveCell({ row: rowIndex, col: colIndex })}
                                onNavigate={(direction) => navigateCell(rowIndex, colIndex, direction)}
                                onSave={(next) => saveCell(lead, col, next)}
                              />
                            ) : (
                              <div className="min-h-10 px-2.5 py-2 text-xs text-on-surface-variant/35" aria-hidden="true" />
                            )}
                          </td>
                        );
                      })}

                      <td className="border-r border-outline-variant bg-surface-container-low/25 px-2 py-1 align-middle" />

                      <td style={{ width: 112, minWidth: 112, maxWidth: 112 }} className="sticky right-0 z-10 w-28 border-l border-outline-variant bg-surface-container-lowest px-2 py-1 align-middle text-center shadow-xs group-hover/row:bg-surface-container-low">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Chi tiết ${lead.customerName}`}
                            title="Chi tiết Lead"
                            onClick={() => setDetailLead(lead)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-1 focus-visible:outline-primary"
                          >
                            <PanelRightOpen aria-hidden="true" className="size-3.5" />
                          </button>
                          {lead.sourceConversationId && (
                            <button
                              type="button"
                              aria-label={`Mở hội thoại với ${lead.customerName}`}
                              title="Mở hội thoại Omni-Inbox"
                              onClick={() => handleGoToChat(lead.customerName, lead.sourceConversationId, lead.sourcePlatform, lead.sourceAccountId)}
                              className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-1 focus-visible:outline-primary"
                            >
                              <MessageCircle aria-hidden="true" className="size-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={lead.moduleSync ? `${lead.customerName} đã đồng bộ module` : `Đồng bộ ${lead.customerName} sang module`}
                            title={lead.moduleSync ? `Đã chuyển sang ${lead.moduleSync.targetModule}` : "Đồng bộ sang module khác"}
                            disabled={Boolean(lead.moduleSync)}
                            onClick={() => setSyncLead(lead)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-40"
                          >
                            <ArrowRightLeft aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Xóa ${lead.customerName}`}
                            title="Xóa Lead"
                            onClick={() => setDeleteTarget(lead)}
                            className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-error-container hover:text-error focus-visible:outline-1 focus-visible:outline-primary"
                          >
                            <Trash2 aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <TablePagination
            appearance="erp"
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            itemLabel="Lead"
            pageSizeOptions={[25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Simple Quick Add Column Modal using standard ErpModal + StyledSelect */}
      <ErpModal
        isOpen={quickColModalOpen}
        title={activeAccount ? `Thêm cột mới (${activeAccount.displayName})` : "Thêm cột mới vào Lead Sheet"}
        maxWidth="max-w-sm"
        closeDisabled={quickColBusy}
        onClose={() => {
          if (!quickColBusy) setQuickColModalOpen(false);
        }}
      >
        <form onSubmit={(event) => void handleQuickAddColumn(event)} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="quick-col-label" className="block text-xs text-on-surface-variant">Tên cột mới</label>
            <input
              id="quick-col-label"
              autoFocus
              value={quickColLabel}
              disabled={quickColBusy}
              onChange={(event) => setQuickColLabel(event.target.value)}
              placeholder="VD: Ngày sinh, Nguồn khách, Ngân sách…"
              className={fieldInputClass}
            />
          </div>
          <div className="space-y-1">
            <span className="block text-xs text-on-surface-variant">Kiểu dữ liệu</span>
            <StyledSelect
              ariaLabel="Kiểu dữ liệu"
              value={quickColType}
              disabled={quickColBusy}
              options={fieldTypeSelectOptions}
              onChange={(next) => setQuickColType(next as LeadIntakeFieldType)}
              className="h-9 rounded-xl"
            />
          </div>
          {(quickColType === "single_select" || quickColType === "multi_select") && (
            <div className="space-y-1">
              <label htmlFor="quick-col-options" className="block text-xs text-on-surface-variant">
                Các lựa chọn (ngăn cách dấu phẩy)
              </label>
              <input
                id="quick-col-options"
                value={quickColOptions}
                disabled={quickColBusy}
                onChange={(event) => setQuickColOptions(event.target.value)}
                className={fieldInputClass}
              />
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface">
            <input
              type="checkbox"
              checked={quickColRequired}
              disabled={quickColBusy}
              onChange={(event) => setQuickColRequired(event.target.checked)}
              className="size-4 accent-primary"
            />
            <span>Chatbot chủ động hỏi trường này</span>
          </label>
          {quickColError && (
            <p role="alert" className="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">
              {quickColError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-outline-variant pt-3">
            <button
              type="button"
              onClick={() => {
                setQuickColModalOpen(false);
                setBuilderState({ open: true, addColumn: true, accountKey: builderInitialAccountKey });
              }}
              className="text-xs text-primary hover:underline focus-visible:outline-1 focus-visible:outline-primary"
            >
              Cấu hình nhiều cột…
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={quickColBusy}
                onClick={() => setQuickColModalOpen(false)}
                className={secondaryBtnClass}
              >
                Hủy
              </button>
              <button type="submit" disabled={quickColBusy || !quickColLabel.trim()} className={primaryCreateButtonClass}>
                {quickColBusy && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
                Thêm cột
              </button>
            </div>
          </div>
        </form>
      </ErpModal>

      {/* Confirm Column Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteColumnTarget)}
        title="Xóa cột khỏi Lead Sheet?"
        description={
          deleteColumnTarget
            ? `Cột "${deleteColumnTarget.label}" sẽ được gỡ khỏi cấu hình Lead Sheet và Chatbot ngừng hỏi trường này.`
            : ""
        }
        appearance="erp"
        tone="danger"
        confirmLabel="Xóa cột"
        isSubmitting={deletingColumn}
        onClose={() => {
          if (!deletingColumn) setDeleteColumnTarget(null);
        }}
        onConfirm={() => void handleConfirmDeleteColumn()}
      />

      {/* Column & Chatbot Question Builder Modal */}
      <LeadIntakeBuilderModal
        isOpen={builderState.open}
        accounts={accounts}
        initialAccountKey={builderState.accountKey ?? builderInitialAccountKey}
        initialAddColumn={builderState.addColumn}
        focusFieldKey={builderState.focusFieldKey}
        onClose={() => setBuilderState({ open: false, addColumn: false })}
        onSaved={(savedAccount) => {
          if (savedAccount) {
            toast.success(`Đã cập nhật bộ cột Lead & Chatbot cho ${PLATFORM_LABELS[savedAccount.platform]} · ${savedAccount.displayName}.`);
            onSelectAccountScope?.(savedAccount.platform, savedAccount.accountId);
          } else {
            toast.success("Đã cập nhật bộ cột Lead mặc định cho toàn doanh nghiệp.");
          }
          void loadProfiles();
          void loadLeads();
        }}
      />

      {/* Side Drawer for Full Lead Editing */}
      <LeadDetailDrawer
        lead={detailLead}
        configuredFields={scopedProfile?.fields || []}
        onClose={() => setDetailLead(null)}
        onUpdated={(updated) => {
          setLeads(current => current.map(item => (item.id === updated.id ? updated : item)));
          toast.success("Đã lưu thay đổi Lead.");
        }}
        onOpenChat={(lead) => {
          setDetailLead(null);
          handleGoToChat(lead.customerName, lead.sourceConversationId, lead.sourcePlatform, lead.sourceAccountId);
        }}
        onOpenModuleSync={(lead) => {
          setDetailLead(null);
          setSyncLead(lead);
        }}
        onRequestDelete={(lead) => {
          setDeleteTarget(lead);
        }}
      />

      {/* Sync Lead to Education / Healthcare / Workers Module */}
      {syncLead && (
        <LeadModuleSyncModal
          lead={syncLead}
          companyCode={companyCode}
          branchId={branchId}
          enabledModules={enabledModules}
          onClose={() => setSyncLead(null)}
          onCompleted={(moduleSync) => {
            setLeads(current => current.map(item => (item.id === syncLead.id ? { ...item, moduleSync } : item)));
            setSyncLead(null);
          }}
        />
      )}

      {/* Confirm Lead Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xóa Lead khỏi bảng?"
        description={
          deleteTarget
            ? `Khách hàng "${deleteTarget.customerName}" và toàn bộ dữ liệu thu thập của dòng này sẽ bị xóa khỏi Lead Sheet.`
            : ""
        }
        appearance="erp"
        tone="danger"
        confirmLabel="Xóa Lead"
        isSubmitting={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
};
