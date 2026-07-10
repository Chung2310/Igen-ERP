import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { authService } from "../services/authService";
import { UserProfile } from "../types";
import { toast } from "../pages/Toast";
import { parseFirebaseError } from "../utils/firebaseErrorParser";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileInfo: (displayName: string, photoURL: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
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

  const loginWithEmail = async (email: string, password: string, rememberMe: boolean = true) => {
    setLoading(true);
    try {
      const result = await authService.loginWithEmail(email, password);
      const profile: UserProfile = {
        ...result.user,
        uid: result.user._id,
      };
      setUser(profile as any);
      setUserProfile(profile);
      toast.success("Đăng nhập tài khoản thành công!");
    } catch (error: any) {
      console.error("[loginWithEmail] Error:", error);
      const friendlyMsg = parseFirebaseError(error, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      toast.error(friendlyMsg);
      throw error;
    } finally {
      setLoading(false);
    }
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
      toast.error("Lỗi khi đăng xuất.");
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

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshProfile,
        updateProfileInfo,
        uploadAvatar,
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
