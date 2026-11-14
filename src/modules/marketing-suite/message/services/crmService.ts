import { apiFetch } from "../../../shared/lib/apiFetch";
import { getAccessToken } from "../../shared/services/authService";
import { LeadCard } from "../../shared/types/index";
import type { LeadCollectionStatus, LeadIntakeField, LeadNeed, LeadNeedGroup, LeadTargetModule } from "../../../../../shared/marketing-suite/lead-intake";

export interface LeadProductSelection {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ExtendedLeadCard extends LeadCard {
  lastInteractionTime?: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  selectedProducts?: LeadProductSelection[];
  answers?: Record<string, string>;
  intakeFields?: LeadIntakeField[];
  sourcePlatform?: "facebook" | "zalo" | "tiktok";
  sourceAccountId?: string;
  sourceConversationId?: string;
  intakeProfileId?: string;
  intakeProfileVersion?: number;
  collectionStatus?: LeadCollectionStatus;
  lastInteractionAt?: string;
  customerId?: string;
  needs?: LeadNeed[];
  moduleSync?: { targetModule: LeadTargetModule; targetRecordId: string; syncedAt: string; syncedBy: string };
}


export interface LeadPageResult {
  data: ExtendedLeadCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadFieldFilter {
  key: string;
  altKeys?: string[];
  value: string;
  mode?: "exact" | "contains" | "unchecked";
}

export interface LeadPageQueryOptions {
  page: number;
  limit?: number;
  search?: string;
  channel?: "all" | "facebook" | "zalo" | "tiktok";
  accountId?: string;
  status?: string;
  collectionStatus?: string;
  fieldFilters?: LeadFieldFilter[];
  sort?: string;
}

export interface ActiveLeadIntakeProfile {
  id: string;
  platform?: "facebook" | "zalo" | "tiktok";
  accountId?: string;
  version?: number;
  status?: "draft" | "active" | "archived";
  goal?: string;
  completionMessage?: string;
  sourceDocumentIds?: string[];
  fields: LeadIntakeField[];
}

export interface LeadIntakeProfileVersion {
  _id?: string;
  platform?: "facebook" | "zalo" | "tiktok";
  accountId?: string;
  version: number;
  status: "draft" | "active" | "archived";
  needGroups?: LeadNeedGroup[];
  goal: string;
  fields: LeadIntakeField[];
  completionMessage: string;
  sourceDocumentIds?: string[];
}

type CrmLeadRecord = ExtendedLeadCard & { _id?: string };

type LeadIntakeProfileInput = Pick<LeadIntakeProfileVersion, "platform" | "accountId" | "goal" | "completionMessage" | "fields" | "sourceDocumentIds" | "needGroups">;

function leadIntakeScopePayload(input: Pick<LeadIntakeProfileInput, "platform" | "accountId">) {
  return input.platform && input.accountId ? { platform: input.platform, pageId: input.accountId } : {};
}

function logCrmTiming(
  operation: "subscribe" | "create" | "update" | "delete" | "bulkUpdate",
  startedAt: number,
  details?: Record<string, unknown>
) {
  const durationMs = Date.now() - startedAt;
  console.info(`[CRM:${operation}]`, {
    durationMs,
    ...details,
  });
}

// Central cache state for crmService to optimize performance
let cachedLeads: ExtendedLeadCard[] = [];
let listeners: Array<{
  callback: (leads: ExtendedLeadCard[]) => void;
  onError?: (error: unknown) => void;
}> = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isFirstFetchDone = false;
let activeGetLeadsPromise: Promise<ExtendedLeadCard[]> | null = null;

const triggerListeners = (data: ExtendedLeadCard[]) => {
  listeners.forEach((listener) => {
    try {
      listener.callback(data);
    } catch (err) {
      console.error("[crmService] Error in listener callback:", err);
    }
  });
};

const triggerListenersError = (err: unknown) => {
  listeners.forEach((listener) => {
    if (listener.onError) {
      try {
        listener.onError(err);
      } catch (e) {
        console.error("[crmService] Error in listener error callback:", e);
      }
    }
  });
};

const fetchLeadsInternal = async () => {
  try {
    const data = await crmService.getLeads();
    // Only trigger listener callback if data changed (prevent deep re-renders and blinking)
    const dataStr = JSON.stringify(data);
    const cachedStr = JSON.stringify(cachedLeads);
    if (!isFirstFetchDone || dataStr !== cachedStr) {
      cachedLeads = data;
      isFirstFetchDone = true;
      triggerListeners(data);
    }
  } catch (err) {
    triggerListenersError(err);
  }
};

export const crmService = {
  getLeads(): Promise<ExtendedLeadCard[]> {
    if (activeGetLeadsPromise) {
      return activeGetLeadsPromise;
    }

    activeGetLeadsPromise = (async () => {
      try {
        const res = await fetch("/api/v1/omni-inbox/leads?limit=1000", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
        });
        if (!res.ok) {
          throw new Error("Không thể tải danh sách Lead.");
        }
        const json = await res.json();
        return ((json.data as CrmLeadRecord[] | undefined) || []).map((item) => ({
          ...item,
          id: item._id || item.id, // Bản đồ MongoDB _id sang id
        }));
      } finally {
        activeGetLeadsPromise = null;
      }
    })();

    return activeGetLeadsPromise;
  },

  async getLeadPage(options: LeadPageQueryOptions): Promise<LeadPageResult> {
    const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit || 50) });
    if (options.search?.trim()) params.set("search", options.search.trim());
    if (options.channel && options.channel !== "all") params.set("sourcePlatform", options.channel);
    if (options.accountId) params.set("sourceAccountId", options.accountId);
    if (options.status && options.status !== "all") params.set("status", options.status);
    if (options.collectionStatus && options.collectionStatus !== "all") params.set("collectionStatus", options.collectionStatus);
    if (options.fieldFilters && options.fieldFilters.length > 0) {
      params.set("fieldFilters", JSON.stringify(options.fieldFilters));
    }
    if (options.sort) params.set("sort", options.sort);
    const response = await fetch(`/api/v1/omni-inbox/leads?${params.toString()}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) throw new Error("Không thể tải danh sách Lead.");
    const json = await response.json();
    return {
      data: ((json.data as CrmLeadRecord[] | undefined) || []).map(item => ({ ...item, id: item._id || item.id })),
      total: Number(json.total) || 0,
      page: Number(json.page) || options.page,
      limit: Number(json.limit) || options.limit || 50,
      totalPages: Number(json.totalPages) || 0,
    };
  },

  async getActiveLeadIntakeProfiles(): Promise<ActiveLeadIntakeProfile[]> {
    const response = await fetch("/api/v1/marketing-settings/lead-intake-profiles", {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) return [];
    const json = await response.json();
    const rawActive = Array.isArray(json.data?.activeProfiles) ? json.data.activeProfiles as Array<LeadIntakeProfileVersion & { _id?: string }> : [];
    const rawFallback = Array.isArray(json.data?.fallbackProfiles) ? json.data.fallbackProfiles as Array<LeadIntakeProfileVersion & { _id?: string }> : [];
    const combined = [...rawFallback, ...rawActive];
    const seenIds = new Set<string>();
    const normalized: ActiveLeadIntakeProfile[] = [];
    for (const profile of combined) {
      if (!profile._id || seenIds.has(profile._id)) continue;
      seenIds.add(profile._id);
      normalized.push({
        id: profile._id,
        ...(profile.platform ? { platform: profile.platform } : {}),
        ...(profile.accountId ? { accountId: profile.accountId } : {}),
        version: profile.version,
        status: profile.status,
        goal: profile.goal,
        completionMessage: profile.completionMessage,
        sourceDocumentIds: profile.sourceDocumentIds,
        fields: profile.fields || [],
      });
    }
    return normalized;
  },

  async getLeadIntakeProfilesForAccount(platform?: "facebook" | "zalo" | "tiktok", accountId?: string): Promise<{
    profiles: LeadIntakeProfileVersion[];
    fallbackProfiles: LeadIntakeProfileVersion[];
  }> {
    const params = new URLSearchParams();
    if (platform && accountId) {
      params.set("platform", platform);
      params.set("pageId", accountId);
    } else {
      params.set("scope", "company");
    }
    const response = await fetch(`/api/v1/marketing-settings/lead-intake-profiles?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Không thể tải cấu hình thu thập Lead.");
    return {
      profiles: Array.isArray(result.data?.profiles) ? result.data.profiles : [],
      fallbackProfiles: Array.isArray(result.data?.fallbackProfiles) ? result.data.fallbackProfiles : [],
    };
  },

  async suggestLeadIntakeProfile(input: { platform?: "facebook" | "zalo" | "tiktok"; accountId?: string; goal: string }): Promise<LeadIntakeProfileVersion> {
    const response = await fetch("/api/v1/marketing-settings/lead-intake-profiles/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        ...(input.platform && input.accountId ? { platform: input.platform, pageId: input.accountId } : {}),
        goal: input.goal,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Không thể tạo đề xuất cột bằng AI.");
    return result.data as LeadIntakeProfileVersion;
  },

  async saveLeadIntakeDraft(input: LeadIntakeProfileInput): Promise<LeadIntakeProfileVersion> {
    const draftRes = await fetch("/api/v1/marketing-settings/lead-intake-profiles/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({
        ...leadIntakeScopePayload(input),
        goal: input.goal,
        completionMessage: input.completionMessage,
        fields: input.fields,
        ...(input.needGroups ? { needGroups: input.needGroups } : {}),
        sourceDocumentIds: input.sourceDocumentIds,
      }),
    });
    const draftJson = await draftRes.json().catch(() => ({}));
    if (!draftRes.ok) throw new Error(draftJson.message || "Không thể lưu cấu hình cột Lead.");
    const version = Number(draftJson.data?.version);
    if (!Number.isInteger(version) || version < 1) throw new Error("Phiên bản cấu hình không hợp lệ.");
    return { ...draftJson.data, version } as LeadIntakeProfileVersion;
  },

  async saveAndActivateLeadIntakeProfile(input: LeadIntakeProfileInput): Promise<LeadIntakeProfileVersion> {
    const { version } = await this.saveLeadIntakeDraft(input);
    const activateRes = await fetch(`/api/v1/marketing-settings/lead-intake-profiles/${version}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify(leadIntakeScopePayload(input)),
    });
    const activateJson = await activateRes.json().catch(() => ({}));
    if (!activateRes.ok) throw new Error(activateJson.message || "Đã lưu bản nháp nhưng chưa kích hoạt được cấu hình cột.");
    return activateJson.data as LeadIntakeProfileVersion;
  },

  async archiveLeadIntakeProfile(input?: { platform?: "facebook" | "zalo" | "tiktok"; accountId?: string }): Promise<void> {
    const scopePayload = input?.platform && input?.accountId
      ? { platform: input.platform, pageId: input.accountId }
      : {};
    const response = await fetch("/api/v1/marketing-settings/lead-intake-profiles/archive-active", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify(scopePayload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Không thể gỡ bộ cột tùy chỉnh.");
  },

  async getAllLeadRows(options: Omit<LeadPageQueryOptions, "page" | "limit">): Promise<ExtendedLeadCard[]> {
    const result: ExtendedLeadCard[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await crmService.getLeadPage({ ...options, page, limit: 1000 });
      result.push(...response.data);
      totalPages = response.totalPages;
      page++;
    } while (page <= totalPages);
    return result;
  },

  async exportLeadsToGoogleSheets(ids: string[]): Promise<{ queued: number; skipped: number }> {
    const response = await fetch("/api/v1/omni-inbox/leads/export-google-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ ids }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Không thể xuất Lead sang Google Sheets.");
    return result.data as { queued: number; skipped: number };
  },

  async saveLeadCustomer(id: string, input: { customerId: string } | { create: true; name: string; phone: string; email: string; allowSharedPhone: boolean }) {
    const response = await apiFetch<{ data: { customerId: string; customerCode: string } }>(`/omni-inbox/leads/${encodeURIComponent(id)}/customer`, {
      method: "POST", body: JSON.stringify(input),
    });
    return response.data;
  },

  async markLeadModuleSynced(id: string, target: { targetModule: LeadTargetModule; targetRecordId: string }) {
    const response = await fetch(`/api/v1/omni-inbox/leads/${encodeURIComponent(id)}/module-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify(target),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Không thể lưu liên kết Lead với module đích.");
    return result.data as NonNullable<ExtendedLeadCard["moduleSync"]>;
  },

  subscribeLeads(callback: (leads: ExtendedLeadCard[]) => void, onError?: (error: unknown) => void) {
    const listener = { callback, onError };
    listeners.push(listener);

    // If cache is ready, emit immediately to avoid visual lag
    if (isFirstFetchDone) {
      callback(cachedLeads);
    } else {
      fetchLeadsInternal();
    }

    if (!pollInterval) {
      // Use single centralized interval to poll database
      pollInterval = setInterval(fetchLeadsInternal, 5000);
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
      if (listeners.length === 0 && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        isFirstFetchDone = false;
      }
    };
  },

  async createLead(lead: Omit<ExtendedLeadCard, "id">): Promise<string> {
    const startedAt = Date.now();
    const tempId = `temp-${Date.now()}`;

    // 1. Instantly update UI with a temporary ID (0ms lag!)
    const createdLead: ExtendedLeadCard = { ...lead, id: tempId };
    const oldLeads = [...cachedLeads];
    cachedLeads = [...cachedLeads, createdLead];
    triggerListeners(cachedLeads);

    try {
      const res = await fetch("/api/v1/omni-inbox/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          ...lead,
          createdAt: Date.now(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Tạo Lead thất bại.");
      }

      const json = await res.json();
      const realId = json.data._id;
      logCrmTiming("create", startedAt, { id: realId });

      // 2. Swap temporary ID with real ID in the cache
      cachedLeads = cachedLeads.map((item) =>
        item.id === tempId ? { ...item, id: realId } : item
      );
      triggerListeners(cachedLeads);

      // Re-sync background cache
      fetchLeadsInternal();
      return realId;
    } catch (err) {
      // Rollback optimistic update on error
      cachedLeads = oldLeads;
      triggerListeners(cachedLeads);
      throw err;
    }
  },

  async updateLead(id: string, lead: Partial<ExtendedLeadCard>): Promise<ExtendedLeadCard> {
    const startedAt = Date.now();
    
    // 1. Optimistic Update (Immediate 120fps feel)
    const oldLeads = [...cachedLeads];
    cachedLeads = cachedLeads.map((item) =>
      item.id === id ? { ...item, ...lead } : item
    );
    triggerListeners(cachedLeads);

    const res = await fetch(`/api/v1/omni-inbox/leads/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        ...lead,
        updatedAt: Date.now(),
      }),
    });

    if (!res.ok) {
      // Rollback optimistic update on error
      cachedLeads = oldLeads;
      triggerListeners(cachedLeads);
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Cập nhật Lead thất bại.");
    }

    const json = await res.json().catch(() => ({}));
    const updatedItem = json.data as CrmLeadRecord | undefined;
    const normalizedItem: ExtendedLeadCard = updatedItem
      ? { ...updatedItem, id: updatedItem._id || updatedItem.id || id }
      : { ...(cachedLeads.find((item) => item.id === id) || {}), ...lead, id } as ExtendedLeadCard;

    cachedLeads = cachedLeads.map((item) => (item.id === id ? normalizedItem : item));
    triggerListeners(cachedLeads);

    logCrmTiming("update", startedAt, { id, fields: Object.keys(lead) });
    return normalizedItem;
  },

  async deleteLead(id: string): Promise<void> {
    const startedAt = Date.now();

    // 1. Optimistic UI update
    const oldLeads = [...cachedLeads];
    cachedLeads = cachedLeads.filter((item) => item.id !== id);
    triggerListeners(cachedLeads);

    const res = await fetch(`/api/v1/omni-inbox/leads/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      // Rollback on error
      cachedLeads = oldLeads;
      triggerListeners(cachedLeads);
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Xóa Lead thất bại.");
    }

    logCrmTiming("delete", startedAt, { id });
    fetchLeadsInternal();
  },

  async bulkUpdateLeads(updates: Array<{ id: string; lead: Partial<ExtendedLeadCard> }>): Promise<void> {
    const startedAt = Date.now();
    if (updates.length === 0) return;

    // 1. Optimistic UI update
    const oldLeads = [...cachedLeads];
    cachedLeads = cachedLeads.map((item) => {
      const update = updates.find((u) => u.id === item.id);
      return update ? { ...item, ...update.lead } : item;
    });
    triggerListeners(cachedLeads);

    try {
      await Promise.all(
        updates.map(({ id, lead }) =>
          fetch(`/api/v1/omni-inbox/leads/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${getAccessToken()}`,
            },
            body: JSON.stringify({
              ...lead,
              updatedAt: Date.now(),
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.message || "Cập nhật thất bại.");
            }
          })
        )
      );
    } catch (err) {
      // Rollback on error
      cachedLeads = oldLeads;
      triggerListeners(cachedLeads);
      throw err;
    }

    logCrmTiming("bulkUpdate", startedAt, {
      count: updates.length,
      ids: updates.map(({ id }) => id),
    });

    fetchLeadsInternal();
  },
};
