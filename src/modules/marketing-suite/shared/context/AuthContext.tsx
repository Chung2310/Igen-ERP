import { useCallback, useMemo } from "react";
import { useAuth as useErpAuth } from "../../../../context/AuthContext";
import type { UserProfile } from "../types";
import type { AIChatConfig } from "../../message/types/crm";
import { getAccessToken } from "../../../../services/authService";

/** Reuse the ERP session. Imported views never create a second auth provider. */
export function useAuth() {
  const context = useErpAuth();
  const { userProfile: erpProfile, refreshProfile } = context;
  const userProfile = useMemo((): UserProfile | null => {
    const profile = erpProfile;
    if (!profile) return null;
    const permissions = [...(profile.permissions || [])];
    if (permissions.includes("*") || permissions.includes("marketing:manage") || profile.role === "admin" || profile.role === "superadmin") permissions.push("marketing:post");
    return { ...profile, permissions } as unknown as UserProfile;
  }, [erpProfile]);
  const updateAiAutoReplyConfig = useCallback(async (config: AIChatConfig) => {
    const response = await fetch("/api/v1/marketing-settings/auto-reply", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` }, body: JSON.stringify(config),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Không thể lưu cấu hình AI.");
    }
    await refreshProfile();
  }, [refreshProfile]);
  return { ...context, user: userProfile, userProfile, updateAiAutoReplyConfig };
}
