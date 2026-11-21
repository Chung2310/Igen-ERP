import "../../shared/marketing-workspace.css";
import "../crm-workspace.css";
import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Zap, MessageSquare, Settings2, Users, FlaskConical } from "lucide-react";
import { CRMSubTabType, ChatMessage, CustomerInbox, AIChatConfig, ChatPagination } from "../../shared/types/index";
import { toast } from "../../../../pages/Toast";
import { crmService, subscribeCrmLeadChanges, type ConversationLead, type CreateLeadInput, type ExtendedLeadCard } from "../services/crmService";
import { chatTestService } from "../services/chatTestService";
import { useAuth } from "../../shared/context/AuthContext";
import { useBranchOptional } from "../../../../context/BranchContext";
import { fbMessengerService } from "../services/fbMessengerService";
import { mapInboxMessages as mapFbMessages, type RawInboxMessage } from "../services/inboxMessageMapping";
import { startInboxMessagePolling } from "../services/inboxMessagePolling";
import { createInboxRefreshQueue } from "../services/inboxRefreshQueue";
import { zaloMessengerService } from "../services/zaloMessengerService";
import { tiktokMessengerService } from "../services/tiktokMessengerService";
import { getAccessToken } from "../../shared/services/authService";
import { socketService, type MessengerScope } from "../../../../services/socketService";
import { useSubTabRouter } from "../../../../hooks/useSubTabRouter";
import { ModuleNavigation, ModuleNavigationButton } from "../../../../components/common/ModuleNavigation";
import { ErpModal } from "../../../../components/common/ErpModal";
import { StyledSelect } from "../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../components/common/primaryCreateButton";
import { socialIntegrationService, SocialIntegration } from "../../shared/services/socialIntegrationService";
import { resolveAiReplyScope } from "../../shared/utils/aiReplyScope";
import { AI_REPLY_PRIMARY_MODEL } from "../../../../../shared/marketing-suite/ai-reply-models";
import type { LeadSheetColumn, LeadSocialPlatform } from "../components/crm/leadSheetUtils";
import { CreateLeadModal } from "../components/crm/CreateLeadModal";
import { SocialPlatformIcon } from "../components/crm/SocialPlatformIcon";

function getCustomerInitials(customerName: string) {
  const parts = customerName.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "KH";
}

function isSameInboxIdentity(
  left: Pick<CustomerInbox, "id" | "channel" | "accountId"> | null | undefined,
  right: Pick<CustomerInbox, "id" | "channel" | "accountId"> | null | undefined,
) {
  return !!left && !!right && left.id === right.id && left.channel === right.channel && left.accountId === right.accountId;
}

function getInboxIdentityKey(customer: Pick<CustomerInbox, "id" | "channel" | "accountId">) {
  return JSON.stringify([customer.channel || "", customer.accountId || "", customer.id]);
}

type InboxChannel = MessengerScope["channel"];

// Lazy-loaded subcomponents
const LeadTable = lazy(() =>
  import("../components/crm/LeadTable").then((module) => ({
    default: module.LeadTable,
  }))
);
const LeadIntakeBuilderModal = lazy(() =>
  import("../components/crm/LeadIntakeBuilderModal").then(module => ({ default: module.LeadIntakeBuilderModal }))
);
const ChatTestTab = lazy(() =>
  import("../components/crm/ChatTestTab").then(module => ({ default: module.ChatTestTab }))
);
const OmniChatTab = lazy(() =>
  import("../components/crm/OmniChatTab").then((module) => ({
    default: module.OmniChatTab,
  }))
);
const AiCommentReplyManager = lazy(() =>
  import("../components/crm/AiCommentReplyManager").then((module) => ({
    default: module.AiCommentReplyManager,
  }))
);

const CRM_SUB_TAB_ROUTES = [
  { slug: "lead", value: "LEAD" as CRMSubTabType },
  { slug: "omni-chat", value: "OMNI-INBOX CHAT" as CRMSubTabType },
  { slug: "comment-reply", value: "AI COMMENT AUTO-REPLY" as CRMSubTabType },
  { slug: "chat-test", value: "CHAT TEST" as CRMSubTabType },
] as const;

export default function CRMTab() {
  const [subTab, setSubTab] = useSubTabRouter<CRMSubTabType>(CRM_SUB_TAB_ROUTES, "LEAD");
  const [activeChannel, setActiveChannel] = useState<"all" | "facebook" | "zalo" | "tiktok">("all");

  const [leadSheetRefreshToken, setLeadSheetRefreshToken] = useState(0);
  const [inboxLeadSettingsScope, setInboxLeadSettingsScope] = useState<string | null>(null);
  const [directConversationId, setDirectConversationId] = useState<string>();

  useEffect(() => {
    if (subTab !== "LEAD") return;
    return subscribeCrmLeadChanges(() => setLeadSheetRefreshToken(count => count + 1));
  }, [subTab]);

  const [leadSearchQuery, setLeadSearchQuery] = useState("");

  const [createLeadForm, setCreateLeadForm] = useState<{
    columns: LeadSheetColumn[];
    scope?: { platform: LeadSocialPlatform; accountId?: string };
  } | null>(null);

  // 2. Omni-Inbox States
  const { userProfile, hasPermission, updateAiAutoReplyConfig } = useAuth();
  const branchContext = useBranchOptional();
  const [companySocialIntegrations, setCompanySocialIntegrations] = useState<SocialIntegration[]>([]);

  // Connection status requires a usable personal or company account.
  const isFbConnected = React.useMemo(() => {
    const hasPersonal = !!(userProfile?.facebookIntegration?.isConnected && userProfile.facebookIntegration.pageId);
    const hasCompany = companySocialIntegrations.some(item => item.platform === "Facebook" && item.isConnected && item.username);
    return hasPersonal || hasCompany;
  }, [userProfile, companySocialIntegrations]);

  const isZaloConnected = React.useMemo(() => {
    const hasPersonal = !!(userProfile?.zaloIntegration?.isConnected && userProfile.zaloIntegration.oaId);
    const hasCompany = companySocialIntegrations.some(item => item.platform === "Zalo" && item.isConnected && item.username);
    return hasPersonal || hasCompany;
  }, [userProfile, companySocialIntegrations]);

  const isTiktokConnected = React.useMemo(() => {
    const hasPersonal = !!(userProfile?.tiktokIntegration?.isConnected && userProfile.tiktokIntegration.username);
    const hasCompany = companySocialIntegrations.some(item => item.platform === "TikTok" && item.isConnected && item.username);
    return hasPersonal || hasCompany;
  }, [userProfile, companySocialIntegrations]);

  // 3. Multi-page Facebook state
  const facebookPages = React.useMemo(() => {
    const list: Array<{ _id: string; displayName: string; username: string; isMock?: boolean }> = [];
    if (userProfile?.facebookIntegration?.isConnected && userProfile.facebookIntegration.pageId) {
      list.push({
        _id: "personal",
        displayName: userProfile.facebookIntegration.pageName || "Fanpage cá nhân",
        username: userProfile.facebookIntegration.pageId,
        isMock: !!userProfile.facebookIntegration.isMock,
      });
    }
    companySocialIntegrations.forEach((item) => {
      if (item.platform === "Facebook" && item.isConnected && item.username) {
        if (!list.some(p => p.username === item.username)) {
          list.push({
            _id: item._id || "company_" + item.username,
            displayName: item.displayName || `Fanpage ${item.username}`,
            username: item.username,
            isMock: !!item.isMock,
          });
        }
      }
    });

    return list;
  }, [userProfile, companySocialIntegrations]);

  const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string>(() => {
    const saved = localStorage.getItem("crm_selected_fb_page_id");
    return saved || "";
  });

  // Zalo Accounts
  const zaloAccounts = React.useMemo(() => {
    const list: Array<{ _id: string; displayName: string; username: string; isMock?: boolean }> = [];
    if (userProfile?.zaloIntegration?.isConnected && userProfile.zaloIntegration.oaId) {
      list.push({
        _id: "personal",
        displayName: userProfile.zaloIntegration.oaName || "Zalo OA cá nhân",
        username: userProfile.zaloIntegration.oaId,
        isMock: !!userProfile.zaloIntegration.isMock,
      });
    }
    companySocialIntegrations.forEach((item) => {
      if (item.platform === "Zalo" && item.isConnected && item.username) {
        list.push({
          _id: item._id || "company_" + item.username,
          displayName: item.displayName || `Zalo OA ${item.username}`,
          username: item.username,
          isMock: !!item.isMock,
        });
      }
    });

    return list;
  }, [userProfile, companySocialIntegrations]);

  const [selectedZaloAccountId, setSelectedZaloAccountId] = useState<string>("");

  // TikTok Accounts
  const tiktokAccounts = React.useMemo(() => {
    const list: Array<{ _id: string; displayName: string; username: string; isMock?: boolean }> = [];
    if (userProfile?.tiktokIntegration?.isConnected && userProfile.tiktokIntegration.username) {
      list.push({
        _id: "personal",
        displayName: userProfile.tiktokIntegration.displayName || userProfile.tiktokIntegration.username || "Tài khoản TikTok cá nhân",
        username: userProfile.tiktokIntegration.username,
        isMock: !!userProfile.tiktokIntegration.isMock,
      });
    }
    companySocialIntegrations.forEach((item) => {
      if (item.platform === "TikTok" && item.isConnected && item.username) {
        list.push({
          _id: item._id || "company_" + item.username,
          displayName: item.displayName || `TikTok ${item.username}`,
          username: item.username,
          isMock: !!item.isMock,
        });
      }
    });



    return list;
  }, [userProfile, companySocialIntegrations]);

  const [selectedTiktokAccountId, setSelectedTiktokAccountId] = useState<string>("");

  const [showUnifiedDropdown, setShowUnifiedDropdown] = useState(false);
  const [unifiedDropdownPosition, setUnifiedDropdownPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const unifiedDropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const unifiedDropdownPanelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!showUnifiedDropdown) return;

    const updatePosition = () => {
      const trigger = unifiedDropdownTriggerRef.current;
      if (!trigger) return;

      const bounds = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const width = Math.min(320, Math.max(0, window.innerWidth - viewportPadding * 2));
      const spaceBelow = Math.max(0, window.innerHeight - bounds.bottom - gap - viewportPadding);
      const spaceAbove = Math.max(0, bounds.top - gap - viewportPadding);
      const openAbove = spaceBelow < 280 && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(120, Math.min(360, availableHeight));
      const left = Math.max(viewportPadding, Math.min(bounds.right - width, window.innerWidth - width - viewportPadding));
      const top = openAbove
        ? Math.max(viewportPadding, bounds.top - gap - maxHeight)
        : Math.min(window.innerHeight - viewportPadding - maxHeight, bounds.bottom + gap);


      setUnifiedDropdownPosition({ top, left, width, maxHeight });
    };

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !unifiedDropdownPanelRef.current?.contains(target) && !unifiedDropdownTriggerRef.current?.contains(target)) {
        setShowUnifiedDropdown(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowUnifiedDropdown(false);
    };

    updatePosition();
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showUnifiedDropdown]);

  // Synchronize selectedFacebookPageId when facebookPages changes
  useEffect(() => {
    const validPages = facebookPages.filter(p => p.username);
    if (validPages.length > 0) {
      const hasMatch = validPages.some(p => p.username === selectedFacebookPageId);
      if (!selectedFacebookPageId || !hasMatch) {
        const firstPage = validPages[0].username;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep Page fallback and its persisted selection synchronized with asynchronous account options.
        setSelectedFacebookPageId(firstPage);
        localStorage.setItem("crm_selected_fb_page_id", firstPage);
      }
    } else {
      if (selectedFacebookPageId !== "") {
        setSelectedFacebookPageId("");
        localStorage.removeItem("crm_selected_fb_page_id");
      }
    }
  }, [facebookPages, selectedFacebookPageId]);

  // Synchronize Zalo & TikTok selected accounts
  useEffect(() => {
    if (zaloAccounts.length > 0) {
      if (!selectedZaloAccountId || !zaloAccounts.some(a => a.username === selectedZaloAccountId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the legacy account fallback when external connection options change.
        setSelectedZaloAccountId(zaloAccounts[0].username);
      }
    } else if (selectedZaloAccountId) {
      setSelectedZaloAccountId("");
    }
  }, [zaloAccounts, selectedZaloAccountId]);

  useEffect(() => {
    if (tiktokAccounts.length > 0) {
      if (!selectedTiktokAccountId || !tiktokAccounts.some(a => a.username === selectedTiktokAccountId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the legacy account fallback when external connection options change.
        setSelectedTiktokAccountId(tiktokAccounts[0].username);
      }
    } else if (selectedTiktokAccountId) {
      setSelectedTiktokAccountId("");
    }
  }, [tiktokAccounts, selectedTiktokAccountId]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyIntegrations = async () => {
      try {
        const data = await socialIntegrationService.getAccounts("omni-inbox");
        if (!cancelled) {
          setCompanySocialIntegrations(data || []);
          console.log("[FE CRMTab] Loaded company social integrations:", data);
        }
      } catch (error) {
        console.error("[FE CRMTab] Khong the tai company social integrations:", error);
      }
    };

    void loadCompanyIntegrations();

    return () => {
      cancelled = true;
    };
  }, []);

  const [inboxCustomers, setInboxCustomers] = useState<CustomerInbox[]>([]);
  const inboxCustomersRef = useRef(inboxCustomers);
  useEffect(() => { inboxCustomersRef.current = inboxCustomers; }, [inboxCustomers]);
  const [activeCustomer, setActiveCustomer] = useState<CustomerInbox | null>(null);
  const [isInboxLoading, setIsInboxLoading] = useState(false);

  const leadConversationId = activeCustomer?.id;
  const activeLeadAccountId = activeCustomer?.accountId;
  const leadChannel = activeCustomer?.channel;
  const activeLeadKey = activeCustomer ? getInboxIdentityKey(activeCustomer) : null;
  const [leadLookup, setLeadLookup] = useState<{ key: string; data: ConversationLead | null } | null>(null);
  const linkedLead = leadLookup?.key === activeLeadKey ? leadLookup?.data ?? null : null;

  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT" || !activeLeadKey || !leadConversationId || !activeLeadAccountId || !leadChannel) return;
    const controller = new AbortController();
    const unsubscribe = subscribeCrmLeadChanges(async () => {
      try {
        const data = await crmService.getLeadForConversation(leadChannel, activeLeadAccountId, leadConversationId, controller.signal);
        if (!controller.signal.aborted) setLeadLookup({ key: activeLeadKey, data });
      } catch (error) {
        if (!controller.signal.aborted) console.error("[CRM] Không tải được Lead của hội thoại:", error);
      }
    }, true);
    return () => { controller.abort(); unsubscribe(); };
  }, [subTab, activeLeadKey, activeLeadAccountId, leadChannel, leadConversationId]);


  // Keep activeCustomer in a ref to avoid stale closures in socket handlers
  const activeCustomerRef = useRef<CustomerInbox | null>(null);
  useEffect(() => {
    activeCustomerRef.current = activeCustomer;
  }, [activeCustomer]);

  // Conversations list pagination state for infinite scroll
  const [convsPagination, setConvsPagination] = useState({
    limit: 20,
    skip: 0,
    hasMore: true,
    isLoadingMore: false,
  });

  const convsPaginationRef = useRef(convsPagination);
  useEffect(() => {
    convsPaginationRef.current = convsPagination;
  }, [convsPagination]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatPagination, setChatPagination] = useState<ChatPagination>({
    limit: 20,
    hasMore: false,
    nextBefore: null,
    loadingMore: false,
  });

  const [typeMessage, setTypeMessage] = useState("");
  const [aiWaiting] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketConnectedRef = useRef(socketConnected);
  useEffect(() => {
    socketConnectedRef.current = socketConnected;
  }, [socketConnected]);
  const inboxFetchVersionRef = useRef(0);
  const inboxLoadRef = useRef<{ version: number; done: Promise<void> } | null>(null);

  const resetInboxForAccountChange = () => {
    inboxFetchVersionRef.current += 1;
    activeCustomerRef.current = null;
    inboxCustomersRef.current = [];
    setInboxCustomers([]);
    setActiveCustomer(null);
    setIsInboxLoading(true);
    setConvsPagination({ limit: 20, skip: 0, hasMore: true, isLoadingMore: false });
    setChatHistory([]);
    setChatPagination({ limit: 20, hasMore: false, nextBefore: null, loadingMore: false });
  };

  // AI assistant configurations
  const [aiConfig, setAIConfig] = useState<AIChatConfig>({
    enabled: true,
    commentReplyEnabled: false,
    imageReplyEnabled: false,
    autoClassify: true,
    autoCloseDeal: true,
    autoFeedback: true,
    replyDelay: 15,
    customerAddressStyle: "",
    advancedInstructions: "",
    customerServiceScript: "",
    customerServiceScriptFileName: "",
    trainingKnowledge: "",
    model: AI_REPLY_PRIMARY_MODEL,
    autoFollowUpEnabled: false,
    followUpDelayHours: 2,
    followUpPrompt: ""
  });

  const replyScope = resolveAiReplyScope({
    customer: activeCustomer, activeChannel, facebookId: selectedFacebookPageId,
    zaloId: selectedZaloAccountId, tiktokId: selectedTiktokAccountId,
  });
  const targetReplyIntegration = companySocialIntegrations.find(item =>
    item.platform === replyScope.platform && item.username === replyScope.accountId
  );
  const currentReplyScopeRef = useRef(replyScope.key);
  useLayoutEffect(() => { currentReplyScopeRef.current = replyScope.key; }, [replyScope.key]);

  // Synchronize AI Config based on selected page/channel or fallback to userProfile
  useEffect(() => {
    const targetIntegration = targetReplyIntegration;

    if (targetIntegration?.aiAutoReplyConfig) {
      const config = targetIntegration.aiAutoReplyConfig as unknown as AIChatConfig;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the existing account/user configuration precedence and normalization across Page changes.
      setAIConfig({
        enabled: config.enabled ?? true,
        commentReplyEnabled: config.commentReplyEnabled ?? false,
        imageReplyEnabled: config.imageReplyEnabled ?? false,
        autoClassify: true,
        autoCloseDeal: true,
        autoFeedback: true,
        replyDelay: config.replyDelay ?? 15,
        customerAddressStyle: config.customerAddressStyle ?? "",
        advancedInstructions: config.advancedInstructions ?? "",
        customerServiceScript: config.customerServiceScript ?? "",
        customerServiceScriptFileName: config.customerServiceScriptFileName ?? "",
        trainingKnowledge: config.trainingKnowledge ?? "",
        model: AI_REPLY_PRIMARY_MODEL,
        autoFollowUpEnabled: config.autoFollowUpEnabled ?? false,
        followUpDelayHours: config.followUpDelayHours ?? 2,
        followUpPrompt: config.followUpPrompt ?? ""
      });
      return;
    }

    // fallback
    {
      const fallbackConfig = targetIntegration ? undefined : userProfile?.aiAutoReplyConfig;
      setAIConfig({
        enabled: fallbackConfig?.enabled ?? true,
        commentReplyEnabled: fallbackConfig?.commentReplyEnabled ?? false,
        imageReplyEnabled: fallbackConfig?.imageReplyEnabled ?? false,
        autoClassify: true,
        autoCloseDeal: true,
        autoFeedback: true,
        replyDelay: fallbackConfig?.replyDelay ?? 15,
        customerAddressStyle: fallbackConfig?.customerAddressStyle ?? "",
        advancedInstructions: fallbackConfig?.advancedInstructions ?? "",
        customerServiceScript: fallbackConfig?.customerServiceScript ?? "",
        customerServiceScriptFileName: fallbackConfig?.customerServiceScriptFileName ?? "",
        trainingKnowledge: fallbackConfig?.trainingKnowledge ?? "",
        model: AI_REPLY_PRIMARY_MODEL,
        autoFollowUpEnabled: fallbackConfig?.autoFollowUpEnabled ?? false,
        followUpDelayHours: fallbackConfig?.followUpDelayHours ?? 2,
        followUpPrompt: fallbackConfig?.followUpPrompt ?? ""
      });
    }
  }, [replyScope.key, targetReplyIntegration, userProfile]);

  const handleUpdateAIConfig = async (newConfig: AIChatConfig) => {
    const configWithTimestamp: AIChatConfig = {
      ...newConfig,
      model: AI_REPLY_PRIMARY_MODEL,
      autoClassify: true,
      autoCloseDeal: true,
      autoFeedback: true,
      disabledAt: newConfig.enabled === false ? new Date().toISOString() : null,
    };

    try {
      const integrationId = targetReplyIntegration?._id;
      const targetIntegrationId = integrationId && !integrationId.startsWith("company_") ? integrationId : null;
      if (targetReplyIntegration && !targetIntegrationId) {
        throw new Error("Không thể xác định tài khoản liên kết để lưu cấu hình AI.");
      }

      if (targetIntegrationId) {
        const res = await fetch(`/api/v1/omni-inbox/accounts/${targetIntegrationId}/ai-config`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ aiAutoReplyConfig: configWithTimestamp }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(result.message || "Không thể lưu cấu hình AI cho tài khoản liên kết.");
        }
        // Update local state in memory
        setCompanySocialIntegrations(prev =>
          prev.map(item => item._id === targetIntegrationId ? { ...item, aiAutoReplyConfig: configWithTimestamp as unknown as Record<string, unknown> } : item)
        );
      }

      if (!targetIntegrationId) await updateAiAutoReplyConfig(configWithTimestamp);
      if (currentReplyScopeRef.current === replyScope.key) setAIConfig(configWithTimestamp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi lưu cấu hình AI";
      console.error("[CRMTab] Lỗi lưu cấu hình AI:", err);
      toast.error(msg);
      throw err;
    }
  };

  const [copyingConfig, setCopyingConfig] = useState(false);

  const handleApplyToAllPages = async () => {
    const activeId = targetReplyIntegration?._id || null;

    if (!activeId) {
      toast.warning("Chỉ hỗ trợ đồng bộ cấu hình giữa các tài khoản liên kết doanh nghiệp.");
      return;
    }

    const otherIntegrations = companySocialIntegrations.filter(item => item.isConnected && item._id !== activeId);
    if (otherIntegrations.length === 0) {
      toast.info("Không có tài khoản doanh nghiệp liên kết nào khác để đồng bộ.");
      return;
    }

    const confirmSync = window.confirm(
      `Bạn có chắc chắn muốn áp dụng cấu hình AI hiện tại cho tất cả ${otherIntegrations.length} tài khoản doanh nghiệp liên kết khác không?`
    );
    if (!confirmSync) return;

    setCopyingConfig(true);
    let successCount = 0;
    try {
      for (const integration of otherIntegrations) {
        const res = await fetch(`/api/v1/omni-inbox/accounts/${integration._id}/ai-config`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ aiAutoReplyConfig: aiConfig }),
        });
        if (res.ok) {
          successCount++;
          setCompanySocialIntegrations(prev =>
            prev.map(item => item._id === integration._id ? { ...item, aiAutoReplyConfig: aiConfig as unknown as Record<string, unknown> } : item)
          );
        }
      }
      toast.success(`Đã sao chép cấu hình thành công sang ${successCount}/${otherIntegrations.length} tài khoản khác!`);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Lỗi xảy ra trong quá trình đồng bộ cấu hình.");
    } finally {
      setCopyingConfig(false);
    }
  };
  type RawInboxConversation = {
    _id?: string;
    recipientId?: string;
    openId?: string;
    senderName?: string;
    avatarUrl?: string;
    lastMessageText?: string;
    lastMessageAt?: string;
    unreadCount?: number;
    isVip?: boolean;
    tags?: string[];
    aiPausedUntil?: string | null;
  };

  const loadConversationMessages = async (
    conversationId: string,
    mode: "replace" | "prepend" = "replace",
    channel?: "facebook" | "zalo" | "tiktok",
    options?: { syncChannel?: boolean; accountId?: string }
  ) => {


    const before = mode === "prepend" ? chatPagination.nextBefore || undefined : undefined;
    if (mode === "prepend") {
      setChatPagination((prev) => ({ ...prev, loadingMore: true }));
    }

    const targetChannel = channel || activeCustomer?.channel || "facebook";
    const targetAccountId = options?.accountId || (
      targetChannel === "facebook"
        ? selectedFacebookPageId
        : targetChannel === "zalo"
          ? selectedZaloAccountId
          : selectedTiktokAccountId
    );

    try {
      let result;
      if (conversationId.startsWith("mock_")) {
        result = {
          data: [],
          pagination: { limit: 20, hasMore: false, nextBefore: null }
        };
      } else {
        result = targetChannel === "zalo"
          ? await zaloMessengerService.getMessages(conversationId, { limit: 20, before, sync: !!options?.syncChannel, accountId: targetAccountId })
          : targetChannel === "tiktok"
            ? await tiktokMessengerService.getMessages(conversationId, { limit: 20, before, sync: !!options?.syncChannel, accountId: targetAccountId })
            : await fbMessengerService.getMessages(conversationId, { limit: 20, before, sync: !!options?.syncChannel, pageId: targetAccountId });
      }

      // NgÄƒn cháº·n race-condition khi ngÆ°á» i dÃ¹ng chuyá»ƒn Ä‘á»•i khÃ¡ch hÃ ng nhanh
      // conversationId o day la Mongo _id cua conversation trong DB, khong phai PSID/UID cua khach.
      if (!isSameInboxIdentity(activeCustomerRef.current, { id: conversationId, channel: targetChannel, accountId: targetAccountId })) {
        console.log(`[FE CRMTab] Race-condition detected: Bỏ qua kết quả load tin nhắn của khách hàng cũ (${conversationId}).`);
        return;
      }

      const mappedMsgs = mapFbMessages(result.data);

      if (mode === "prepend") {
        setChatHistory((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const older = mappedMsgs.filter((item) => !seen.has(item.id));
          if (older.length === 0) {
            return prev;
          }
          return [...older, ...prev];
        });
      } else {
        setChatHistory((prev) => {
          // Kiá»ƒm tra xem tin nháº¯n má»›i láº¥y vá» cÃ³ thuá»™c cÃ¹ng má»™t cuá»™c há»™i thoáº¡i Ä‘ang táº£i khÃ´ng
          const isSameConversation = prev.length > 0 && mappedMsgs.length > 0 &&
            (prev[0].conversationId === mappedMsgs[0].conversationId ||
              prev[0].id.startsWith("user_") ||
              prev.some(m => mappedMsgs.some(nm => nm.id === m.id)));

          if (isSameConversation) {
            // Gộp tin nhắn mới/cập nhật mà không làm mất lịch sử cũ đã cuộn để tải lên
            const merged = [...prev];
            mappedMsgs.forEach((newMsg) => {
              const idx = merged.findIndex((m) => m.id === newMsg.id || (m.id.startsWith("user_") && m.text === newMsg.text && m.sender === newMsg.sender));
              if (idx !== -1) {
                merged[idx] = newMsg; // Cập nhật tin nhắn sẵn có (trạng thái/id thật)
              } else {
                merged.push(newMsg); // Thêm tin nhắn mới
              }
            });
            return merged.sort((x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime());
          } else {
            // Cuộc hội thoại khác (chuyển user), thay thế toàn bộ bằng tin nhắn mới
            return mappedMsgs;
          }
        });
      }

      setChatPagination({
        limit: result.pagination.limit || 20,
        hasMore: !!result.pagination.hasMore,
        nextBefore: result.pagination.nextBefore || null,
        loadingMore: false,
      });
    } catch (err) {
      setChatPagination((prev) => ({ ...prev, loadingMore: false }));
      throw err;
    }
  };

  const inboxFetchVersion = inboxFetchVersionRef.current;
  const fetchOmniConversations = async (
    forceSelectFirst = false,
    options?: { syncFacebook?: boolean; loadMore?: boolean; reset?: boolean; channels?: InboxChannel[] },
    requestVersion = inboxFetchVersion
  ) => {
    if (requestVersion !== inboxFetchVersionRef.current) return;
    let pending = inboxLoadRef.current;
    if (options?.loadMore && pending?.version === requestVersion) return;
    while (pending?.version === requestVersion) {
      await pending.done;
      if (requestVersion !== inboxFetchVersionRef.current) return;
      pending = inboxLoadRef.current;
    }
    let finishLoad!: () => void;
    const load = { version: requestVersion, done: new Promise<void>(resolve => { finishLoad = resolve; }) };
    inboxLoadRef.current = load;
    try {
      const isLoadMore = !!options?.loadMore;
      const isReset = !!options?.reset;
      const shouldLoad = (channel: InboxChannel) => !options?.channels || options.channels.includes(channel);
      const failed = new Set<InboxChannel>();

      if (isLoadMore && !convsPaginationRef.current.hasMore) return;
      if (convsPaginationRef.current.isLoadingMore) return;

      if (isLoadMore) {
        setConvsPagination(prev => ({ ...prev, isLoadingMore: true }));
      }

      if (isReset) {
        setIsInboxLoading(true);
      }


      const currentSkip = isReset
        ? 0
        : (isLoadMore ? convsPaginationRef.current.skip + convsPaginationRef.current.limit : 0);

      const limit = isReset
        ? 20
        : (isLoadMore ? convsPaginationRef.current.limit : (convsPaginationRef.current.skip + convsPaginationRef.current.limit || 20));

      let fbConvs: RawInboxConversation[] = [];
      let zaloConvs: RawInboxConversation[] = [];

      if (shouldLoad("facebook") && isFbConnected && selectedFacebookPageId) {
        const isMockFb = selectedFacebookPageId === "igen_marketing_demo" || selectedFacebookPageId?.includes("mock");
        if (isMockFb) {
          fbConvs = [];
        } else {
          try {
            fbConvs = await fbMessengerService.getConversations({
              sync: !!options?.syncFacebook,
              pageId: selectedFacebookPageId,
              limit,
              skip: currentSkip
            });
          } catch (err) {
            console.error("Lỗi lấy hội thoại Facebook:", err);
            failed.add("facebook");
          }
        }
      }
      if (requestVersion !== inboxFetchVersionRef.current) return;

      if (shouldLoad("zalo") && isZaloConnected && selectedZaloAccountId) {
        const isMockZalo = selectedZaloAccountId === "igen_zalo_demo" || selectedZaloAccountId?.includes("mock");
        if (isMockZalo) {
          zaloConvs = [];
        } else {
          try {
            zaloConvs = await zaloMessengerService.getConversations({
              accountId: selectedZaloAccountId,
              limit,
              skip: currentSkip
            });
          } catch (err) {
            console.error("Lỗi lấy hội thoại Zalo:", err);
            failed.add("zalo");
          }
        }
      }
      if (requestVersion !== inboxFetchVersionRef.current) return;

      let tiktokConvs: RawInboxConversation[] = [];
      if (shouldLoad("tiktok") && isTiktokConnected && selectedTiktokAccountId) {
        try {
          tiktokConvs = await tiktokMessengerService.getConversations({
            accountId: selectedTiktokAccountId,
            limit,
            skip: currentSkip
          });
        } catch (err) {
          console.error("Lỗi lấy hội thoại TikTok:", err);
          failed.add("tiktok");
        }
      }
      if (requestVersion !== inboxFetchVersionRef.current) return;

      const mappedFb: CustomerInbox[] = fbConvs.map((c) => ({
        id: c._id || c.recipientId || "",
        recipientId: c.recipientId || "",
        name: c.senderName || "Khách hàng Facebook",
        avatar: c.avatarUrl || getCustomerInitials(c.senderName || ""),
        avatarUrl: c.avatarUrl || "",
        lastMessage: c.lastMessageText || "[Đính kèm]",
        time: new Date(c.lastMessageAt || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        unreadCount: c.unreadCount || 0,
        isVip: c.isVip || false,
        status: "offline",
        tags: c.tags || [],
        channel: "facebook",
        accountId: selectedFacebookPageId,
        lastMessageAt: new Date(c.lastMessageAt || Date.now()),
        aiPausedUntil: c.aiPausedUntil || null
      }));

      const mappedZalo: CustomerInbox[] = zaloConvs.map((c) => ({
        id: c._id || c.recipientId || "",
        recipientId: c.recipientId || "",
        name: c.senderName || "Khách hàng Zalo",
        avatar: c.avatarUrl || getCustomerInitials(c.senderName || ""),
        avatarUrl: c.avatarUrl || "",
        lastMessage: c.lastMessageText || "[Đính kèm]",
        time: new Date(c.lastMessageAt || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        unreadCount: c.unreadCount || 0,
        isVip: c.isVip || false,
        status: "offline",
        tags: c.tags || [],
        channel: "zalo",
        accountId: selectedZaloAccountId,
        lastMessageAt: new Date(c.lastMessageAt || Date.now()),
        aiPausedUntil: c.aiPausedUntil || null
      }));

      const mappedTiktok: CustomerInbox[] = tiktokConvs.map((c) => ({
        id: c._id || c.openId || "",
        recipientId: c.openId || "",
        name: c.senderName || "Khách hàng TikTok",
        avatar: c.avatarUrl || getCustomerInitials(c.senderName || ""),
        avatarUrl: c.avatarUrl || "",
        lastMessage: c.lastMessageText || "[Đính kèm]",
        time: new Date(c.lastMessageAt || Date.now()).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        unreadCount: c.unreadCount || 0,
        isVip: c.isVip || false,
        status: "offline",
        tags: c.tags || [],
        channel: "tiktok",
        accountId: selectedTiktokAccountId,
        lastMessageAt: new Date(c.lastMessageAt || Date.now()),
        aiPausedUntil: c.aiPausedUntil || null
      }));

      const fetchedList = [...mappedFb, ...mappedZalo, ...mappedTiktok];



      const hasMoreFetched = [fbConvs, zaloConvs, tiktokConvs].some(rows => rows.length >= limit);

      setInboxCustomers((prev) => {
        if (requestVersion !== inboxFetchVersionRef.current) return prev;
        const baseList = (isLoadMore && !isReset) ? prev : prev.filter(customer => customer.channel
          && (!shouldLoad(customer.channel) || failed.has(customer.channel)));
        const previousById = new Map(prev.map(customer => [getInboxIdentityKey(customer), customer]));
        const existingIds = new Set(baseList.map(getInboxIdentityKey));
        const filteredNew = fetchedList.filter((x) => !existingIds.has(getInboxIdentityKey(x))).map(customer => {
          const previous = previousById.get(getInboxIdentityKey(customer));
          return previous && previous.lastMessageAt > customer.lastMessageAt ? { ...customer,
            lastMessage: previous.lastMessage, lastMessageAt: previous.lastMessageAt, time: previous.time,
            unreadCount: previous.unreadCount,
          } : customer;
        });

        const combined = [...baseList, ...filteredNew].map((c) => {
          if (isSameInboxIdentity(c, activeCustomerRef.current)) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        }).sort(
          (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
        );

        if (combined.length > 0) {
          setActiveCustomer((prevActive) => {
            if (prevActive && !forceSelectFirst) {
              const found = combined.find((x) => isSameInboxIdentity(x, prevActive));
              return found || (options?.channels ? prevActive : combined[0]);
            }
            return combined[0];
          });
        } else if (!options?.channels) {
          setActiveCustomer(null);
        }

        return combined;
      });

      if (!options?.channels) {
        setConvsPagination({ limit: 20, skip: currentSkip,
          hasMore: hasMoreFetched || (failed.size > 0 && convsPaginationRef.current.hasMore), isLoadingMore: false });
      }
    } catch (err) {
      if (requestVersion !== inboxFetchVersionRef.current) return;
      console.error("[FE CRMTab] Lỗi khi tải danh sách hội thoại:", err);
      setConvsPagination(prev => ({ ...prev, isLoadingMore: false }));
    } finally {
      if (inboxLoadRef.current === load) inboxLoadRef.current = null;
      finishLoad();
      if (requestVersion === inboxFetchVersionRef.current) {
        setIsInboxLoading(false);
      }
    }
  };

  const loadConversationMessagesRef = useRef(loadConversationMessages);
  useEffect(() => {
    loadConversationMessagesRef.current = loadConversationMessages;
  });

  // Track Socket.IO connection status
  useEffect(() => {
    const unsubscribeStatus = socketService.onStatusChange(setSocketConnected);
    const unsubscribeScopes = socketService.onMessengerScopesChange(() => {
      const customer = activeCustomerRef.current;
      if (!customer || !socketService.isMessengerScopeReady(customer.channel, customer.accountId)) return;
      // Recover the small gap before room authorization completed, using DB history once.
      void loadConversationMessagesRef.current(customer.id, "replace", customer.channel, { accountId: customer.accountId })
        .catch(error => console.error("[FE CRMTab] Không thể tải lịch sử sau khi đăng ký realtime:", error));
    });

    return () => {
      unsubscribeStatus();
      unsubscribeScopes();
    };
  }, []);

  useEffect(() => {
    const scopes: MessengerScope[] = [];
    if (subTab === "OMNI-INBOX CHAT") {
      if (selectedFacebookPageId) scopes.push({ channel: "facebook", accountId: selectedFacebookPageId });
      if (selectedZaloAccountId) scopes.push({ channel: "zalo", accountId: selectedZaloAccountId });
      if (selectedTiktokAccountId) scopes.push({ channel: "tiktok", accountId: selectedTiktokAccountId });
    }
    socketService.setMessengerScopes(scopes);
    return () => socketService.setMessengerScopes([]);
  }, [subTab, selectedFacebookPageId, selectedZaloAccountId, selectedTiktokAccountId]);

  // Handle Socket.IO realtime events
  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT" || (!isFbConnected && !isZaloConnected && !isTiktokConnected)) return;

    const refreshQueue = createInboxRefreshQueue<InboxChannel>(async channels => {
      if (!document.hidden) await fetchOmniConversations(false, { channels }, inboxFetchVersionRef.current);
    });
    const selectedScopes: MessengerScope[] = [];
    if (selectedFacebookPageId) selectedScopes.push({ channel: "facebook", accountId: selectedFacebookPageId });
    if (selectedZaloAccountId) selectedScopes.push({ channel: "zalo", accountId: selectedZaloAccountId });
    if (selectedTiktokAccountId) selectedScopes.push({ channel: "tiktok", accountId: selectedTiktokAccountId });
    const isSelectedScope = (channel?: InboxChannel, accountId?: string) =>
      selectedScopes.some(scope => scope.channel === channel && scope.accountId === accountId);

    const updateConversation = (channel: InboxChannel, accountId: string, conversation?: RawInboxConversation) => {
      const id = conversation?._id;
      if (!conversation || !id || !inboxCustomersRef.current.some(customer => isSameInboxIdentity(customer, { id, channel, accountId }))) {
        refreshQueue.request(channel);
        return;
      }
      const timestamp = conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : undefined;
      const date = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp : undefined;
      setInboxCustomers(prev => prev.map(customer => {
        if (!isSameInboxIdentity(customer, { id, channel, accountId }) || (date && date < customer.lastMessageAt)) return customer;
        return { ...customer,
          aiPausedUntil: conversation.aiPausedUntil || null,
          lastMessage: conversation.lastMessageText || customer.lastMessage,
          lastMessageAt: date ?? customer.lastMessageAt,
          time: date ? date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : customer.time,
          unreadCount: isSameInboxIdentity(activeCustomerRef.current, customer) ? 0 : conversation.unreadCount ?? customer.unreadCount,
          name: conversation.senderName || customer.name,
          avatarUrl: conversation.avatarUrl || customer.avatarUrl,
          avatar: conversation.avatarUrl || customer.avatar,
        };
      }).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()));
      setActiveCustomer(prev => prev && isSameInboxIdentity(prev, { id, channel, accountId })
        && (prev.aiPausedUntil ?? null) !== (conversation.aiPausedUntil ?? null)
        ? { ...prev, aiPausedUntil: conversation.aiPausedUntil || null } : prev);
    };

    const handleNewMessage = (data: {
      message: RawInboxMessage;
      channel?: "facebook" | "zalo" | "tiktok";
      accountId?: string;
      conversation?: RawInboxConversation;
    }) => {
      const { channel, accountId, message, conversation } = data;
      if (!channel || !accountId || !isSelectedScope(channel, accountId)) return;
      const activeCust = activeCustomerRef.current;
      updateConversation(channel, accountId, conversation);

      if (activeCust) {
        const activeId = activeCust.id?.toString();
        const msgConvId = (typeof message.conversationId === "object" && message.conversationId ? (message.conversationId as Record<string, string>)._id : message.conversationId)?.toString();
        console.log("[FE CRMTab] Comparing active customer & new message:", {
          activeCustomer: { id: activeId, channel: activeCust.channel, accountId: activeCust.accountId, name: activeCust.name },
          message: { conversationId: msgConvId, channel, accountId }
        });

        const isMatch = !!msgConvId && isSameInboxIdentity(activeCust, { id: msgConvId, channel, accountId });

        if (isMatch) {
          console.log("[FE CRMTab] Match found! Appending message to current chat view.");

          if (message.direction === "inbound" && (conversation?.unreadCount ?? 1) > 0) {
            const messenger = channel === "zalo" ? zaloMessengerService : channel === "tiktok" ? tiktokMessengerService : fbMessengerService;
            void messenger.markRead(activeId, accountId).catch(() => {});
          }

          const mapped = mapFbMessages([message])[0];
          setChatHistory((prev) => {
            const optimisticIndex = prev.findIndex(
              (m) => m.id.startsWith("user_") && m.text === mapped.text && m.sender === mapped.sender
            );
            if (optimisticIndex !== -1) {
              const nextHistory = [...prev];
              nextHistory[optimisticIndex] = mapped; // Thay thế bằng tin nhắn chính thức từ DB
              return nextHistory;
            }

            if (prev.some((m) => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        } else {
          console.log("[FE CRMTab] Conversation mismatch, message not appended to current view.");
        }
      } else {
        console.log("[FE CRMTab] No active customer selected, skipping message append.");
      }

    };

    const unsubscribeNewMsg = socketService.onNewMessage(handleNewMessage);
    const unsubscribeConvUpdate = socketService.onConversationUpdated((conversation: RawInboxConversation & Partial<MessengerScope>) => {
      const { channel, accountId } = conversation;
      if (channel && accountId && isSelectedScope(channel, accountId)) updateConversation(channel, accountId, conversation);
    });
    const unsubscribeListChange = socketService.on("conversation_list_changed", (scope: Partial<MessengerScope>) => {
      if (scope.channel && isSelectedScope(scope.channel, scope.accountId)) refreshQueue.request(scope.channel);
    });
    const unsubscribeReset = socketService.on("company_chat_reset", () => {
      resetInboxForAccountChange();
      void fetchOmniConversations(true, { reset: true }, inboxFetchVersionRef.current);
    });
    const readyChannels = new Set(selectedScopes.filter(scope => socketService.isMessengerScopeReady(scope.channel, scope.accountId)).map(scope => scope.channel));
    const unsubscribeScopes = socketService.onMessengerScopesChange(() => {
      for (const scope of selectedScopes) {
        if (!socketService.isMessengerScopeReady(scope.channel, scope.accountId)) readyChannels.delete(scope.channel);
        else if (!readyChannels.has(scope.channel)) {
          readyChannels.add(scope.channel);
          refreshQueue.request(scope.channel);
        }
      }
    });
    const refreshVisible = () => {
      if (!document.hidden) selectedScopes.forEach(scope => refreshQueue.request(scope.channel));
    };
    document.addEventListener("visibilitychange", refreshVisible);

    return () => {
      refreshQueue.dispose();
      unsubscribeNewMsg();
      unsubscribeConvUpdate();
      unsubscribeListChange();
      unsubscribeReset();
      unsubscribeScopes();
      document.removeEventListener("visibilitychange", refreshVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, isFbConnected, isZaloConnected, selectedFacebookPageId, selectedZaloAccountId, selectedTiktokAccountId]);

  // 1. Polling danh sách hội thoại (FB, Zalo & TikTok) - Tối ưu hiệu năng Visibility
  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT") return;
    if (!isFbConnected && !isZaloConnected && !isTiktokConnected) {
      const timeout = setTimeout(() => {
        resetInboxForAccountChange();
        void fetchOmniConversations(true, { reset: true }, inboxFetchVersionRef.current);
      }, 0);
      return () => clearTimeout(timeout);
    }

    // Tải và tự động chọn cuộc hội thoại đầu tiên khi mount, đổi page FB, hoặc đổi kết nối
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Begin the account-scoped subscription with its existing loading/reset and request-version guards.
    fetchOmniConversations(true, { syncFacebook: true, reset: true });

    const runFetch = () => {
      if (!document.hidden) {
        const scopes = [
          { channel: "facebook" as const, accountId: selectedFacebookPageId },
          { channel: "zalo" as const, accountId: selectedZaloAccountId },
          { channel: "tiktok" as const, accountId: selectedTiktokAccountId },
        ].filter(scope => scope.accountId);
        const missing = scopes.filter(scope => !socketService.isMessengerScopeReady(scope.channel, scope.accountId));
        if (missing.length) void fetchOmniConversations(false, { channels: missing.map(scope => scope.channel) });
      }
    };

    const interval = setInterval(runFetch, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, isFbConnected, isZaloConnected, isTiktokConnected, selectedFacebookPageId, selectedZaloAccountId, selectedTiktokAccountId]);

  // 2. Polling lịch sử tin nhắn của hội thoại đang chọn - Tối ưu hiệu năng Visibility
  useEffect(() => {
    if (subTab !== "OMNI-INBOX CHAT" || !activeCustomer) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the initial conversation loading sequence before polling/socket fallback takes over.
    loadConversationMessages(activeCustomer.id, "replace", activeCustomer.channel, { syncChannel: true, accountId: activeCustomer.accountId }).catch((err) => {
      console.error("[FE CRMTab] Lỗi khi tải lịch sử tin nhắn ban đầu:", err);
    });
    const stopPolling = startInboxMessagePolling({
      channel: activeCustomer.channel,
      isVisible: () => !document.hidden,
      isSocketConnected: () => socketConnectedRef.current && socketService.isMessengerScopeReady(activeCustomer.channel, activeCustomer.accountId),
      refresh: (syncChannel) => loadConversationMessages(activeCustomer.id, "replace", activeCustomer.channel, { syncChannel, accountId: activeCustomer.accountId }),
      onError: (error) => console.error("[FE CRMTab] Lỗi khi tải tin nhắn:", error),
    });

    const handleVisibility = () => {
      if (!document.hidden) {
        loadConversationMessages(activeCustomer.id, "replace", activeCustomer.channel, { syncChannel: true, accountId: activeCustomer.accountId }).catch((err) => {
          console.error("[FE CRMTab] Lỗi khi đồng bộ tin nhắn sau khi quay lại tab:", err);
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, activeCustomer?.id, activeCustomer?.channel, activeCustomer?.accountId, socketConnected]);

  // Xóa sách lịch sử chat cũ ngay khi chuyển khách hàng để tránh hiển thị nhầm lẫn
  const [previousHistoryScope, setPreviousHistoryScope] = useState({ id: activeCustomer?.id, channel: activeCustomer?.channel, accountId: activeCustomer?.accountId });
  if (previousHistoryScope.id !== activeCustomer?.id || previousHistoryScope.channel !== activeCustomer?.channel || previousHistoryScope.accountId !== activeCustomer?.accountId) {
    setPreviousHistoryScope({ id: activeCustomer?.id, channel: activeCustomer?.channel, accountId: activeCustomer?.accountId });
    setChatHistory([]);
  }

  const handleSelectCustomer = (cust: CustomerInbox) => {
    if (isSameInboxIdentity(activeCustomerRef.current, cust)) {
      console.log("[FE CRMTab] Khách hàng đã được chọn sẵn, bỏ qua.");
      return;
    }
    console.log("[FE CRMTab] Nhân viên chọn khách hàng từ danh sách:", cust);
    activeCustomerRef.current = cust;
    setActiveCustomer(cust);
    setChatHistory([]); // Xóa sạch lịch sử chat cũ ngay lập tức để tránh hiển thị nhầm lẫn

    // Đặt unreadCount của khách hàng này về 0 ngay lập tức trong local state
    setInboxCustomers((prev) =>
      prev.map((c) => c.id === cust.id && c.channel === cust.channel && c.accountId === cust.accountId ? { ...c, unreadCount: 0 } : c)
    );
    const markReadPromise = cust.channel === "zalo"
      ? zaloMessengerService.markRead(cust.id, cust.accountId)
      : cust.channel === "tiktok"
        ? tiktokMessengerService.markRead(cust.id, cust.accountId)
        : fbMessengerService.markRead(cust.id, cust.accountId);
    markReadPromise.catch((err) => {
      console.error("[FE CRMTab] Khong the mark-read khi mo conversation:", err);
    });
  };

  const handleLoadOlderMessages = async () => {
    if (!activeCustomer || !chatPagination.hasMore || chatPagination.loadingMore) return;
    try {
      await loadConversationMessages(activeCustomer.id, "prepend", activeCustomer.channel, { accountId: activeCustomer.accountId });
    } catch (err) {
      console.error("[FE CRMTab] Lỗi khi tải thêm tin nhắn cũ:", err);
      toast.error("Không thể tải thêm tin nhắn cũ.");
    }
  };

  const handleCreateLead = async (lead: CreateLeadInput) => {
    await crmService.createLead({ ...lead, avatar: getCustomerInitials(lead.customerName) });
    setCreateLeadForm(null);
    toast.success("Đã thêm Lead vào bảng.");
  };

  const handleCreateLeadFromChat = async (customer: CustomerInbox) => {
    const sourcePlatform = customer.channel || "facebook";
    const platformName = sourcePlatform === "zalo" ? "Zalo" : sourcePlatform === "tiktok" ? "TikTok" : "Facebook";
    const personalUsername = sourcePlatform === "facebook"
      ? userProfile?.facebookIntegration?.isConnected ? userProfile.facebookIntegration.pageId : undefined
      : sourcePlatform === "zalo"
        ? userProfile?.zaloIntegration?.isConnected ? userProfile.zaloIntegration.oaId : undefined
        : userProfile?.tiktokIntegration?.isConnected ? userProfile.tiktokIntegration.username : undefined;
    const sourceAccountIsManaged = Boolean(
      customer.accountId
      && (
        companySocialIntegrations.some(item => item.platform === platformName && item.username === customer.accountId)
        || (personalUsername && personalUsername === customer.accountId)
      ),
    );
    const newLead: Omit<ExtendedLeadCard, "id"> = {
      customerName: customer.name,
      company: "",
      value: 0,
      phone: "",
      avatar: getCustomerInitials(customer.name),
      email: "",
      productOfChoice: "",
      status: "cold",
      lastInteraction: "Tạo Lead từ hội thoại",
      lastInteractionTime: "Vừa xong",
      ...(sourceAccountIsManaged ? { sourcePlatform, sourceAccountId: customer.accountId, sourceConversationId: customer.id } : {}),
    };
    try {
      await crmService.createLead(newLead);
      toast.success(`Đã thêm ${customer.name} vào Lead.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo Lead trên hệ thống.");
    }
  };

  const deleteLead = async (id: string) => {
    try {
      await crmService.deleteLead(id);
      toast.info("Đã xóa Lead.");
    } catch {
      toast.error("Không thể xóa Lead trên hệ thống.");
    }
  };
  const handleResumeAI = async (conversationId: string, channel: "facebook" | "zalo" | "tiktok") => {
    try {
      if (channel === "zalo") {
        const customer = inboxCustomers.find((item) => item.id === conversationId && item.channel === channel);
        await zaloMessengerService.resumeAI(conversationId, customer?.accountId);
      } else if (channel === "tiktok") {
        const customer = inboxCustomers.find((item) => item.id === conversationId && item.channel === channel);
        await tiktokMessengerService.resumeAI(conversationId, customer?.accountId);
      } else {
        const customer = inboxCustomers.find((item) => item.id === conversationId && item.channel === channel);
        await fbMessengerService.resumeAI(conversationId, customer?.accountId || selectedFacebookPageId);
      }

      const targetCustomer = inboxCustomers.find((item) => item.id === conversationId && item.channel === channel);
      setActiveCustomer((prev) => prev && prev.id === conversationId && prev.channel === channel && prev.accountId === targetCustomer?.accountId ? { ...prev, aiPausedUntil: null } : prev);
      setInboxCustomers((prev) =>
        prev.map((c) => c.id === conversationId && c.channel === channel && c.accountId === targetCustomer?.accountId ? { ...c, aiPausedUntil: null } : c)
      );

      toast.success("Đã kích hoạt lại AI phản hồi cuộc hội thoại này thành công!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể kích hoạt lại AI.";
      console.error("[CRMTab] Lỗi kích hoạt lại AI:", err);
      toast.error(msg);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = typeMessage.trim();
    if (!msgText || !activeCustomer) return;

    const userMsg: ChatMessage = {
      id: "user_" + Date.now(),
      sender: "agent",
      text: msgText,
      timestamp: new Date(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setTypeMessage("");

    // Cáº­p nháº­t tráº¡ng thÃ¡i táº¡m dá»«ng AI 5 phÃºt cho cuá»™c há»™i thoáº¡i nÃ y trÃªn giao diá»‡n láº­p tá»©c
    const pausedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setActiveCustomer((prev) => isSameInboxIdentity(prev, activeCustomer) ? { ...prev, aiPausedUntil: pausedUntil } : prev);
    setInboxCustomers((prev) => prev.map((c) => isSameInboxIdentity(c, activeCustomer) ? { ...c, aiPausedUntil: pausedUntil } : c));



    try {
      if (activeCustomer.id.startsWith("mock_")) {
        // Giáº£ láº­p gá»­i tin nháº¯n thÃ nh cÃ´ng qua Mock Conversation
        setInboxCustomers((prev) =>
          prev.map((c) =>
            isSameInboxIdentity(c, activeCustomer)
              ? {
                ...c,
                lastMessage: msgText,
                time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
              }
              : c
          )
        );

        // Sau 1.5 giây, giả lập khách hàng tự động phản hồi lại tin nhắn
        setTimeout(() => {
          let customerReply = "Cảm ơn shop đã tư vấn ạ!";
          const textLower = msgText.toLowerCase();
          if (textLower.includes("giá") || textLower.includes("bao nhiêu") || textLower.includes("đắt") || textLower.includes("rẻ") || textLower.includes("phí") || textLower.includes("bao nhiu")) {
            customerReply = "Dạ vâng giá hợp lý quá ạ, shop lên đơn gửi giúp em nhé!";
          } else if (textLower.includes("hàng") || textLower.includes("còn") || textLower.includes("hết") || textLower.includes("sẵn")) {
            customerReply = "Dạ em cảm ơn shop nha, để em chọn size rồi báo shop.";
          } else if (textLower.includes("ship") || textLower.includes("gửi") || textLower.includes("địa chỉ") || textLower.includes("giao")) {
            customerReply = "Dạ địa chỉ của em là 123 Nguyễn Trãi, Thanh Xuân, Hà Nội ạ.";
          } else if (textLower.includes("hợp đồng") || textLower.includes("thanh toán") || textLower.includes("link") || textLower.includes("ký")) {
            customerReply = "Dạ em đã nhận được hợp đồng và link thanh toán. Để em thanh toán luôn ạ!";
          }

          const newInboundMsg: ChatMessage = {
            id: "mock_inbound_" + Date.now(),
            sender: "user", // KhÃ¡ch hÃ ng tráº£ lá»i
            text: customerReply,
            timestamp: new Date(),
          };

          setChatHistory((prev) => isSameInboxIdentity(activeCustomerRef.current, activeCustomer) ? [...prev, newInboundMsg] : prev);

          // Cáº­p nháº­t tin nháº¯n cuá»‘i cÃ¹ng trong danh sÃ¡ch chat
          setInboxCustomers((prev) =>
            prev.map((c) =>
              isSameInboxIdentity(c, activeCustomer)
                ? {
                  ...c,
                  lastMessage: customerReply,
                  time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                }
                : c
            )
          );
        }, 1500);

      } else if (activeCustomer.channel === "zalo") {
        await zaloMessengerService.sendReply(activeCustomer.id, msgText, activeCustomer.accountId);
      } else if (activeCustomer.channel === "tiktok") {
        await tiktokMessengerService.sendReply(activeCustomer.id, msgText, activeCustomer.accountId);
      } else {
        await fbMessengerService.sendReply(activeCustomer.id, msgText, selectedFacebookPageId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi tin nhắn phản hồi.";
      console.error(err);
      toast.error(msg);
      // Revert optimistic updates
      setChatHistory((prev) => prev.filter((h) => h.id !== userMsg.id));
      setActiveCustomer((prev) => isSameInboxIdentity(prev, activeCustomer) ? { ...prev, aiPausedUntil: activeCustomer.aiPausedUntil } : prev);
      setInboxCustomers((prev) =>
        prev.map((c) => isSameInboxIdentity(c, activeCustomer) ? { ...c, aiPausedUntil: activeCustomer.aiPausedUntil } : c)
      );
      loadConversationMessages(activeCustomer.id, "replace", activeCustomer.channel, { syncChannel: true, accountId: activeCustomer.accountId }).catch((reloadErr) => {
        console.error("[FE CRMTab] Lỗi đồng bộ lại lịch sử sau khi gửi thất bại:", reloadErr);
      });
    }
  };

  const handleGoToChat = (customerName: string, conversationId?: string, channel?: string, accountId?: string) => {
    if (conversationId && accountId?.startsWith("chat-test:")) {
      setDirectConversationId(conversationId);
      setSubTab("CHAT TEST");
      return;
    }
    const identityMatch = conversationId ? inboxCustomers.find(c => c.id === conversationId
      && c.channel === channel && (!accountId || c.accountId === accountId)) : undefined;
    const sameName = inboxCustomers.filter(c => c.name.toLowerCase() === customerName.toLowerCase());
    const cust = identityMatch || (!conversationId && sameName.length === 1 ? sameName[0] : undefined);
    if (cust) {
      setActiveCustomer(cust);
      handleSelectCustomer(cust);
      setSubTab("OMNI-INBOX CHAT");
      toast.info(`Đã mở cuộc trò chuyện với ${customerName}`);
    } else if (!conversationId && sameName.length > 1) {
      toast.warning("Có nhiều khách trùng tên. Hãy mở hội thoại từ đúng tài khoản trong hộp thư.");
    } else if (conversationId) {
      void chatTestService.read(conversationId).then(() => {
        setDirectConversationId(conversationId);
        setSubTab("CHAT TEST");
      }).catch(() => toast.warning("Chưa tìm thấy hội thoại nguồn của Lead trong hộp thư."));
    } else {
      toast.warning("Chưa tìm thấy hội thoại nguồn của Lead trong hộp thư.");
    }
  };

  // Keep the selected conversation synchronized with inbox updates.
  useEffect(() => {
    if (!activeCustomer) return;
    const updatedActive = inboxCustomers.find(c => isSameInboxIdentity(c, activeCustomer));
    if (updatedActive && updatedActive !== activeCustomer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the selected conversation synchronized with socket/polling updates to the inbox list.
      setActiveCustomer(updatedActive);
    }
  }, [activeCustomer, inboxCustomers]);

  const activeFbPage = facebookPages.find((p) => p.username === selectedFacebookPageId);
  const activeFbPageName = activeFbPage?.displayName || "Chọn trang FB";

  const activeZaloAccount = zaloAccounts.find((a) => a.username === selectedZaloAccountId);
  const activeZaloAccountName = activeZaloAccount?.displayName || "Chọn Zalo";

  const activeTiktokAccount = tiktokAccounts.find((a) => a.username === selectedTiktokAccountId);
  const activeTiktokAccountName = activeTiktokAccount?.displayName || "Chọn TikTok";
  const leadAccountId = activeChannel === "facebook" ? selectedFacebookPageId
    : activeChannel === "zalo" ? selectedZaloAccountId
      : activeChannel === "tiktok" ? selectedTiktokAccountId : undefined;

  const leadSheetAccounts = React.useMemo(() => {
    const combined: Array<{ id: string; platform: "facebook" | "zalo" | "tiktok"; accountId: string; displayName: string; isMock?: boolean }> = [];
    const seen = new Set<string>();
    const pushItem = (
      platform: "facebook" | "zalo" | "tiktok",
      item: { _id: string; username: string; displayName: string; isMock?: boolean },
    ) => {
      const accountKey = item.username.trim();
      if (!accountKey) return;
      const dedupeKey = `${platform}:${accountKey}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      combined.push({
        id: item._id || accountKey,
        platform,
        accountId: accountKey,
        displayName: item.displayName || accountKey,
        isMock: item.isMock,
      });
    };

    facebookPages.forEach(page => pushItem("facebook", page));
    zaloAccounts.forEach(acc => pushItem("zalo", acc));
    tiktokAccounts.forEach(acc => pushItem("tiktok", acc));
    return combined;
  }, [facebookPages, zaloAccounts, tiktokAccounts]);

  const handleSelectLeadAccountScope = React.useCallback(
    (channel: "all" | "facebook" | "zalo" | "tiktok", nextAccountId?: string) => {
      setActiveChannel(channel);
      if (channel === "facebook" && nextAccountId) {
        setSelectedFacebookPageId(nextAccountId);
        localStorage.setItem("crm_selected_fb_page_id", nextAccountId);
      } else if (channel === "zalo" && nextAccountId) {
        setSelectedZaloAccountId(nextAccountId);
      } else if (channel === "tiktok" && nextAccountId) {
        setSelectedTiktokAccountId(nextAccountId);
      }
    },
    [],
  );
  const hasSelectableChannels = subTab !== "CHAT TEST" && (facebookPages.length > 0 || zaloAccounts.length > 0 || tiktokAccounts.length > 0);
  const canConfigureInboxLead = subTab === "OMNI-INBOX CHAT" && hasPermission("omni-inbox:manage");

  const openInboxLeadSettings = () => {
    const channel = activeCustomer?.channel || activeChannel;
    const accountId = activeCustomer?.accountId || activeCustomer?.pageId || leadAccountId;
    const account = leadSheetAccounts.find(item => item.platform === channel && item.accountId === accountId)
      ?? (leadSheetAccounts.length === 1 ? leadSheetAccounts[0] : undefined);
    setInboxLeadSettingsScope(account ? `${account.platform}:${account.accountId}` : "company");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the source UI's selector closure when linked accounts become unavailable.
    if (!hasSelectableChannels) setShowUnifiedDropdown(false);
  }, [hasSelectableChannels]);

  return (
    <div className="marketing-workspace crm-workspace flex h-full min-h-0 flex-col overflow-hidden rounded-md bg-surface-container-lowest" id="crm_tab_wrapper">
      <h1 className="sr-only">Hệ thống Sales CRM - {subTab}</h1>

      {/* Sub tabs selector bar */}
      <ModuleNavigation label="Mục CRM" activeValue={subTab} id="crm_sub_tabs_switch" actions={(hasSelectableChannels || canConfigureInboxLead) && <div className="relative flex flex-wrap items-center gap-2">
          {canConfigureInboxLead && <button type="button" aria-haspopup="dialog" onClick={openInboxLeadSettings}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
            <Settings2 aria-hidden="true" className="size-4 text-primary" />
            Thu thập Lead
          </button>}
          {hasSelectableChannels && <div className="flex items-center gap-1.5" id="inbox_channel_filters">
            {/* Unified Account Selector Button */}
            <div className="relative">
              <button
                ref={unifiedDropdownTriggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={showUnifiedDropdown}
                aria-controls="crm-account-filter-menu"
                onClick={() => {
                  setShowUnifiedDropdown(!showUnifiedDropdown);
                }}
                className="flex min-h-10 max-w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface shadow-sm transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex items-center -space-x-1">
                  {facebookPages.length > 0 && <SocialPlatformIcon platform="facebook" className="h-4 w-4 rounded-full bg-white ring-1 ring-white" />}
                  {zaloAccounts.length > 0 && <SocialPlatformIcon platform="zalo" className="h-4 w-4 rounded-full ring-1 ring-white" />}
                  {tiktokAccounts.length > 0 && <SocialPlatformIcon platform="tiktok" className="h-4 w-4 rounded-full bg-white ring-1 ring-white" />}
                </span>
                <span className="max-w-[180px] truncate text-xs font-semibold text-on-surface">
                  {activeChannel === "all" && "Tất cả kênh"}
                  {activeChannel === "facebook" && `FB: ${activeFbPageName}`}
                  {activeChannel === "zalo" && `Zalo: ${activeZaloAccountName}`}
                  {activeChannel === "tiktok" && `TikTok: ${activeTiktokAccountName}`}
                </span>
                <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${showUnifiedDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Portal keeps the account picker above clipped inbox/navigation containers. */}
              {showUnifiedDropdown && unifiedDropdownPosition && createPortal(
                  <div
                    ref={unifiedDropdownPanelRef}
                    id="crm-account-filter-menu"
                    role="dialog"
                    aria-label="Chọn tài khoản hiển thị"
                    className="fixed z-[121] overflow-y-auto overscroll-contain rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-left text-on-surface shadow-[0_16px_48px_rgba(15,23,42,0.18)] animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                      top: unifiedDropdownPosition.top,
                      left: unifiedDropdownPosition.left,
                      width: unifiedDropdownPosition.width,
                      maxHeight: unifiedDropdownPosition.maxHeight,
                    }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">Tài khoản hiển thị</div>
                        <div className="mt-0.5 text-xs text-on-surface-variant">Lọc hội thoại theo kênh</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChannel("all");
                          setShowUnifiedDropdown(false);
                        }}
                        className="shrink-0 cursor-pointer rounded-lg bg-primary-container px-3 py-2 text-xs font-semibold text-on-primary-container transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Hiện tất cả
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Facebook Page Selection */}
                      {facebookPages.length > 0 && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                            <SocialPlatformIcon platform="facebook" className="h-4 w-4" />
                            Facebook Page
                          </label>
                          <select
                            value={selectedFacebookPageId}
                            onChange={(e) => {
                              const nextPageId = e.target.value;
                              resetInboxForAccountChange();
                              setSelectedFacebookPageId(nextPageId);
                              localStorage.setItem("crm_selected_fb_page_id", nextPageId);
                              setActiveChannel("facebook");
                            }}
                            className="min-h-10 w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low outline-none focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {facebookPages.map((page) => (
                              <option key={page._id} value={page.username}>{page.displayName}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Zalo Account Selection */}
                      {zaloAccounts.length > 0 && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                            <SocialPlatformIcon platform="zalo" className="h-4 w-4" />
                            Zalo Official Account
                          </label>
                          <select
                            value={selectedZaloAccountId}
                            onChange={(e) => {
                              resetInboxForAccountChange();
                              setSelectedZaloAccountId(e.target.value);
                              setActiveChannel("zalo");
                            }}
                            className="min-h-10 w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low outline-none focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {zaloAccounts.map((acc) => (
                              <option key={acc._id} value={acc.username}>{acc.displayName}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* TikTok Selection */}
                      {tiktokAccounts.length > 0 && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                            <SocialPlatformIcon platform="tiktok" className="h-4 w-4" />
                            TikTok
                          </label>
                          <select
                            value={selectedTiktokAccountId}
                            onChange={(e) => {
                              resetInboxForAccountChange();
                              setSelectedTiktokAccountId(e.target.value);
                              setActiveChannel("tiktok");
                            }}
                            className="min-h-10 w-full cursor-pointer rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low outline-none focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {tiktokAccounts.map((acc) => (
                              <option key={acc._id} value={acc.username}>{acc.displayName}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                  </div>,
                  document.body,
                )}
            </div>
          </div>}
        </div>}>
        {[
          { key: "LEAD" as CRMSubTabType, label: "Lead", icon: Users },
          { key: "OMNI-INBOX CHAT" as CRMSubTabType, label: "Hộp thư hội thoại ", icon: MessageSquare },
          { key: "AI COMMENT AUTO-REPLY" as CRMSubTabType, label: "AI phản hồi bình luận", icon: Zap },
          ...(hasPermission("omni-inbox:manage") ? [{ key: "CHAT TEST" as CRMSubTabType, label: "Thử nghiệm chat", icon: FlaskConical }] : []),
        ].map(({ key, label, icon: Icon }) => <ModuleNavigationButton key={key} active={subTab === key} icon={<Icon />} onClick={() => setSubTab(key)}>{label}</ModuleNavigationButton>)}
      </ModuleNavigation>

      <div className="min-h-0 flex-grow flex-1 overflow-hidden" id="crm_tab_main_content">
        <Suspense fallback={<TabLoader label="Đang tải dữ liệu CRM..." />}>
          {subTab === "CHAT TEST" && (hasPermission("omni-inbox:manage")
            ? <ChatTestTab key={`${userProfile?.companyCode}:${userProfile?.uid}`} accounts={leadSheetAccounts}
                onConfigureLead={setInboxLeadSettingsScope} settingsRevision={leadSheetRefreshToken} initialConversationId={directConversationId} />
            : <p role="alert" className="p-4 text-sm text-error">Bạn cần quyền quản lý hội thoại để thử nghiệm chatbot.</p>)}
          {subTab === "LEAD" && (
            <LeadTable
              searchQuery={leadSearchQuery}
              setSearchQuery={setLeadSearchQuery}
              onCreateLead={columns => setCreateLeadForm({
                columns,
                scope: activeChannel === "all" ? undefined : { platform: activeChannel, accountId: leadAccountId },
              })}
              deleteLead={deleteLead}
              handleGoToChat={handleGoToChat}
              activeChannel={activeChannel}
              accountId={leadAccountId}
              companyCode={userProfile?.companyCode || ""}
              branchId={branchContext?.activeBranchId || userProfile?.branchId || ""}
              enabledModules={userProfile?.enabledModules}
              accounts={leadSheetAccounts}
              onSelectAccountScope={handleSelectLeadAccountScope}
              refreshToken={leadSheetRefreshToken}
              canReconcileContracts={hasPermission("omni-inbox:manage")}
              canManageLeads={hasPermission("omni-inbox:manage")}
            />
          )}

          {subTab === "OMNI-INBOX CHAT" && (
            <OmniChatTab
              inboxCustomers={inboxCustomers}
              activeCustomer={activeCustomer}
              chatHistory={chatHistory}
              chatPagination={chatPagination}
              typeMessage={typeMessage}
              setTypeMessage={setTypeMessage}
              aiWaiting={aiWaiting}
              aiConfig={aiConfig}
              setAIConfig={handleUpdateAIConfig}
              handleSelectCustomer={handleSelectCustomer}
              handleSendChatMessage={handleSendChatMessage}
              handleLoadOlderMessages={handleLoadOlderMessages}
              linkedLead={linkedLead}
              onCreateLeadFromChat={handleCreateLeadFromChat}
              facebookPages={facebookPages}
              selectedFacebookPageId={selectedFacebookPageId}
              selectedZaloAccountId={selectedZaloAccountId}
              selectedTiktokAccountId={selectedTiktokAccountId}
              setSelectedFacebookPageId={setSelectedFacebookPageId}
              handleApplyToAllPages={handleApplyToAllPages}
              copyingConfig={copyingConfig}
              onLoadMoreConversations={() => fetchOmniConversations(false, { loadMore: true })}
              hasMoreConversations={convsPagination.hasMore}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              isFbConnected={isFbConnected}
              isZaloConnected={isZaloConnected}
              isInboxLoading={isInboxLoading}
              onResumeAI={handleResumeAI}
            />
          )}

          {subTab === "AI COMMENT AUTO-REPLY" && (
            <div className="h-full overflow-y-auto p-3 md:p-4">
              <AiCommentReplyManager
                facebookPages={facebookPages}
                selectedFacebookPageId={selectedFacebookPageId}
                setSelectedFacebookPageId={setSelectedFacebookPageId}
                tiktokAccounts={tiktokAccounts}
                selectedTiktokAccountId={selectedTiktokAccountId}
                setSelectedTiktokAccountId={setSelectedTiktokAccountId}
                companySocialIntegrations={companySocialIntegrations}
              />
            </div>
          )}
        </Suspense>
      </div>

      {inboxLeadSettingsScope !== null && <Suspense fallback={null}>
        <LeadIntakeBuilderModal
          isOpen
          accounts={leadSheetAccounts}
          initialAccountKey={inboxLeadSettingsScope}
          hideOcrSettings={subTab === "CHAT TEST"}
          onClose={() => setInboxLeadSettingsScope(null)}
          onSaved={() => {
            setLeadSheetRefreshToken(current => current + 1);
            toast.success("Đã cập nhật cấu hình Lead.");
          }}
        />
      </Suspense>}

      {createLeadForm && <CreateLeadModal
        {...createLeadForm}
        accounts={leadSheetAccounts}
        conversations={inboxCustomers}
        onClose={() => setCreateLeadForm(null)}
        onSave={handleCreateLead}
      />}
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-white p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}



