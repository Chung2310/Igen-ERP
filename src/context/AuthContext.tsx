import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { toast } from "../pages/Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { isModuleEnabled as checkModule, type ModuleKey } from "../config/modules";
import { socketService } from "../services/socketService";
import { normalizeCompanyModulesEvent, normalizeCompanyStatusEvent } from "./companyModuleSync";

export interface ErpLoginChallenge {
  status: "challenge_required";
  challengeId: string;
  enrollmentRequired: boolean;
  expiresAt: string;
}

export type ErpLoginOutcome = { status: "authenticated" } | ErpLoginChallenge;

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<ErpLoginOutcome>;
  completeErpChallenge: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileInfo: (displayName: string, photoURL: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  isModuleEnabled: (key: ModuleKey) => boolean;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Khởi tạo trạng thái đăng nhập khi mount app
  useEffect(() => {
    const initAuth = async () => {
      try {
        const profile = await authService.getMe();
        if (profile) {
          setUser(profile as any);
          setUserProfile(profile);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Lỗi khi tự động khôi phục phiên đăng nhập JWT:", error);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();

    // Thiết lập tự động làm mới access token mỗi 10 phút
    const refreshInterval = setInterval(async () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          await authService.getMe();
        } catch (err) {
          console.error("Lỗi làm mới token định kỳ:", err);
        }
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (!userProfile?.companyCode) return;
    const companyCode = userProfile.companyCode.trim().toUpperCase();
    return socketService.on("company_modules_updated", (value: unknown) => {
      const event = normalizeCompanyModulesEvent(value);
      if (!event || event.companyCode !== companyCode) return;
      setUser((current) => current ? ({ ...current, enabledModules: event.enabledModules } as any) : current);
      setUserProfile((current) => current ? ({ ...current, enabledModules: event.enabledModules }) : current);
      toast.success("Quyền truy cập module của doanh nghiệp vừa được cập nhật.");
    });
  }, [userProfile?.companyCode]);


  useEffect(() => {
    if (!userProfile?.companyCode) return;
    const companyCode = userProfile.companyCode.trim().toUpperCase();
    return socketService.on("company_status_updated", (value: unknown) => {
      const event = normalizeCompanyStatusEvent(value);
      if (!event || event.companyCode !== companyCode) return;
      if (event.lifecycleStatus !== "active") {
        toast.error("Doanh nghiệp của bạn đã bị vô hiệu hoá.");
        void logout();
      }
    });
  }, [userProfile?.companyCode]);

  useEffect(() => {
    if (!userProfile) return;
    return socketService.onStatusChange((connected) => {
      if (!connected) return;
      void authService.getMe().then((profile) => {
        if (!profile) return;
        setUser(profile as any);
        setUserProfile(profile);
      });
    });
  }, [userProfile?.uid]);
  const loginWithEmail = async (email: string, password: string, rememberMe: boolean = true): Promise<ErpLoginOutcome> => {
    setLoading(true);
    try {
      const result = await authService.loginWithEmail(email, password);
      if (result.status === "challenge_required") {
        return {
          status: "challenge_required",
          challengeId: result.challengeId,
          enrollmentRequired: Boolean(result.enrollmentRequired),
          expiresAt: result.expiresAt,
        };
      }
      const profile: UserProfile = {
        ...result.user,
        uid: result.user._id,
      };
      setUser(profile as any);
      setUserProfile(profile);

      // /login không tính enabledModules; gọi /auth/me để lấy đúng cấu hình module của công ty.
      const meProfile = await authService.getMe().catch(() => null);
      if (meProfile) {
        setUser(meProfile as any);
        setUserProfile(meProfile);
      }

      toast.success("Đăng nhập tài khoản thành công!");
      return { status: "authenticated" };
    } catch (error: any) {
      console.error("[loginWithEmail] Error:", error);
      const friendlyMsg = parseFirebaseError(error, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      toast.error(friendlyMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeErpChallenge = async (): Promise<void> => {
    const profile = await authService.getMe();
    if (!profile) {
      localStorage.removeItem("accessToken");
      throw new Error("Không thể khởi tạo phiên ERP sau khi xác thực.");
    }

    setUser(profile as any);
    setUserProfile(profile);
  };

  const registerWithEmail = async (email: string, password: string, displayName: string, rememberMe: boolean = true) => {
    setLoading(true);
    try {
      await authService.registerWithEmail(email, password, displayName);
      // Tự động đăng nhập sau khi đăng ký thành công
      await loginWithEmail(email, password, rememberMe);
    } catch (error: any) {
      console.error("[registerWithEmail] Error:", error);
      const friendlyMsg = parseFirebaseError(error, "Đăng ký thất bại. Vui lòng thử lại.");
      toast.error(friendlyMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (rememberMe: boolean = true) => {
    try {
      await authService.loginWithGoogle();
    } catch (error: any) {
      toast.error(error.message || "Đăng nhập bằng Google thất bại.");
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setUserProfile(null);
      toast.success("Đã đăng xuất tài khoản thành công!");
    } catch (error) {
      console.error("[logout] Error:", error);
      toast.error(getApiErrorMessage(error, "Lỗi khi đăng xuất."));
    } finally {
      setLoading(false);
    }
  };

  const updateProfileInfo = async (displayName: string, photoURL: string) => {
    if (!userProfile) return;
    try {
      const updatedProfile = await authService.updateProfile({ displayName, photoURL });
      setUser(updatedProfile as any);
      setUserProfile(updatedProfile);
      toast.success("Cập nhật thông tin tài khoản thành công!");
    } catch (error: any) {
      console.error("[updateProfileInfo] Error:", error);
      toast.error(error.message || "Cập nhật thông tin thất bại.");
      throw error;
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!userProfile) throw new Error("Chưa đăng nhập");
    try {
      const downloadURL = await authService.uploadAvatar(userProfile.uid, file);
      const updatedProfile = await authService.updateProfile({ photoURL: downloadURL });
      setUser(updatedProfile as any);
      setUserProfile(updatedProfile);
      toast.success("Tải lên ảnh đại diện thành công!");
      return downloadURL;
    } catch (error: any) {
      console.error("Lỗi upload avatar:", error);
      toast.error(error.message || "Tải lên ảnh đại diện thất bại.");
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!userProfile) return;
    try {
      const profile = await authService.getMe();
      if (profile) {
        setUser(profile as any);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error("Lỗi khi làm mới hồ sơ:", error);
    }
  };

  const isModuleEnabled = (key: ModuleKey) => checkModule(userProfile?.enabledModules, key);

  useEffect(() => {
    if (!userProfile) return;
    const companyCode = userProfile.companyCode?.trim().toUpperCase();
    const userId = userProfile.uid;
    return socketService.on("role_permissions_updated", (value: unknown) => {
      const event = value as { userId?: string; companyCode?: string; role?: string };
      if (event.userId !== userId) return;
      if (event.role !== userProfile.role) return;
      if (event.companyCode?.trim().toUpperCase() !== companyCode) return;
      void authService.getMe().then((profile) => {
        if (!profile) return;
        setUser(profile as any);
        setUserProfile(profile);
      });
    });
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode]);

  const hasPermission = (code: string) => Boolean(
    userProfile?.permissions &&
    (userProfile.permissions.includes("*") || userProfile.permissions.includes(code))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        loginWithEmail,
        completeErpChallenge,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshProfile,
        updateProfileInfo,
        uploadAvatar,
        isModuleEnabled,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth phải được sử dụng trong một AuthProvider");
  }
  return context;
};
