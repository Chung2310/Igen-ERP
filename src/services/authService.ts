import { UserProfile, CompanyProfile, TelegramLinkStatus } from "../types";
import { getSuperAdminDeviceId } from "./superAdminRequest";

// Helper để lấy token từ localStorage
export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

export const authService = {
  // Đăng ký bằng Email & Mật khẩu
  async registerWithEmail(email: string, password: string, displayName: string): Promise<any> {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Đăng ký thất bại");
    }

    const result = await res.json();
    return result.data;
  },

  // Đăng nhập bằng Email & Mật khẩu
  async loginWithEmail(email: string, password: string): Promise<any> {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": getSuperAdminDeviceId(),
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Đăng nhập thất bại");
    }

    const result = await res.json();
    // Lưu token truy cập vào localStorage
    if (result.accessToken) {
      localStorage.setItem("accessToken", result.accessToken);
    }
    return result;
  },

  // Đăng nhập bằng Google (Chuyển sang JWT nên tạm thời báo không hỗ trợ)
  async loginWithGoogle(): Promise<any> {
    throw new Error("Đăng nhập bằng Google hiện không khả dụng. Vui lòng sử dụng tài khoản Email.");
  },

  // Đăng xuất
  async logout(): Promise<void> {
    const token = localStorage.getItem("accessToken");
    localStorage.removeItem("accessToken");
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error("Lỗi khi gọi API đăng xuất phía server:", err);
    }
  },

  // Lấy chi tiết hồ sơ người dùng từ backend
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const res = await fetch("/api/v1/auth/me", {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user && (data.user._id === uid || data.user.uid === uid)) {
          return {
            ...data.user,
            uid: data.user._id,
          };
        }
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin người dùng từ Backend:", error);
      return null;
    }
  },

  // Lấy thông tin người dùng hiện tại thông qua JWT Token
  async getMe(): Promise<UserProfile | null> {
    try {
      const token = getAccessToken();
      if (!token) return null;

      const res = await fetch("/api/v1/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // Nếu token hết hạn, thử làm mới bằng refresh-token (cookie)
        const refreshRes = await fetch("/api/v1/auth/refresh-token", {
          method: "POST",
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.accessToken) {
            localStorage.setItem("accessToken", refreshData.accessToken);
            
            // Gọi lại API me với access token mới
            const retryRes = await fetch("/api/v1/auth/me", {
              headers: {
                "Authorization": `Bearer ${refreshData.accessToken}`,
              },
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              return {
                ...retryData.user,
                uid: retryData.user._id,
              };
            }
          }
        }
        return null;
      }

      const data = await res.json();
      return {
        ...data.user,
        uid: data.user._id,
      };
    } catch (error) {
      console.error("Lỗi khi tự động lấy thông tin phiên làm việc getMe:", error);
      return null;
    }
  },

  // Lấy danh sách toàn bộ người dùng
  async getAllUsers(): Promise<UserProfile[]> {
    const res = await fetch("/api/v1/auth/users", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách người dùng");
    }

    const result = await res.json();
    return (result.data || []).map((u: any) => ({
      ...u,
      uid: u._id,
    }));
  },

  // Lấy danh sách người dùng theo Doanh nghiệp
  async getUsersByCompany(companyCode: string, branchId?: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ companyCode });
    if (branchId) params.set("branchId", branchId);
    const res = await fetch(`/api/v1/auth/users?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách người dùng doanh nghiệp");
    }

    const result = await res.json();
    return (result.data || []).map((u: any) => ({
      ...u,
      uid: u._id,
    }));
  },

  // Lấy danh sách đồng nghiệp cùng công ty (mọi user đã đăng nhập đều dùng được)
  async getColleagues(): Promise<UserProfile[]> {
    const res = await fetch(`/api/v1/auth/users/colleagues`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách đồng nghiệp");
    }

    const result = await res.json();
    return (result.data || []).map((u: any) => ({
      ...u,
      uid: u._id,
    }));
  },

  // Cập nhật vai trò người dùng
  async updateUserRole(uid: string, newRole: "user" | "teacher" | "manager" | "admin" | "superadmin"): Promise<void> {
    const res = await fetch(`/api/v1/auth/users/${uid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật vai trò thất bại");
    }
  },

  // Lấy danh sách tất cả doanh nghiệp
  async getAllCompanies(): Promise<CompanyProfile[]> {
    const res = await fetch("/api/v1/auth/companies", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy danh sách doanh nghiệp");
    }

    const result = await res.json();
    return (result.data || []).map((item: any) => ({
      ...item,
      id: item._id || item.id,
    }));
  },

  async updateCompany(companyId: string, updateData: { name?: string; code?: string; ownerEmail?: string; enabledModules?: string[] }): Promise<CompanyProfile> {
    const res = await fetch(`/api/v1/auth/companies/${companyId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể cập nhật doanh nghiệp");
    }

    const result = await res.json();
    return {
      ...result.data,
      id: result.data._id || result.data.id,
    };
  },

  // Cập nhật chi tiết thông tin một nhân sự
  async updateUser(uid: string, updateData: any): Promise<void> {
    const res = await fetch(`/api/v1/auth/users/${uid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật thông tin nhân sự thất bại");
    }
  },

  // Cập nhật hàng loạt thông tin cấu trúc sơ đồ tổ chức
  async bulkUpdateUsers(updates: any[]): Promise<void> {
    const res = await fetch("/api/v1/auth/users/bulk", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ updates }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật cấu trúc sơ đồ tổ chức thất bại");
    }
  },

  // Xóa nhân sự
  async deleteUser(uid: string): Promise<void> {
    const res = await fetch(`/api/v1/auth/users/${uid}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Xóa nhân sự thất bại");
    }
  },

  // Đăng ký doanh nghiệp mới và tạo tài khoản Admin tương ứng qua REST API
  async registerCompanyAndAdmin(
    companyName: string,
    companyCode: string,
    ownerName: string,
    ownerEmail: string,
    ownerPassword: string,
    enabledModules: string[]
  ): Promise<void> {
    const res = await fetch("/api/v1/auth/register-company", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        companyName,
        companyCode,
        ownerName,
        ownerEmail,
        ownerPassword,
        enabledModules,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Đăng ký doanh nghiệp thất bại");
    }
  },

  // Đăng ký người dùng mới cho doanh nghiệp qua REST API
  async registerUserForCompany(
    displayName: string,
    email: string,
    password: string,
    role: "user" | "teacher" | "manager" | "branch_owner" | "admin",
    companyCode: string,
    companyName: string,
    parentId?: string,
    managerLevel?: number,
    department?: string,
    division?: string,
    phone?: string,
    heygenAccess?: {
      avatarIds?: string[];
      avatarId?: string;
      voiceId?: string;
      apiKey?: string;
    },
    jobDescriptionLink?: string,
    branchId?: string,
    birthDate?: string,
    qualification?: string,
    monthlySalary?: number,
    jobDescriptionUploadToken?: string
  ): Promise<string> {
    const res = await fetch("/api/v1/auth/register-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        displayName,
        email,
        password,
        role,
        companyCode,
        companyName,
        parentId,
        level: parentId && managerLevel ? managerLevel + 1 : undefined,
        department,
        division,
        phone,
        heygenAccess,
        jobDescriptionLink,
        branchId,
        birthDate,
        qualification,
        monthlySalary,
        jobDescriptionUploadToken,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Đăng ký thành viên thất bại");
    }

    const result = await res.json();
    return result.data._id; // Trả về ID của user vừa tạo
  },

  // Cập nhật thông tin hồ sơ cá nhân
  async updateProfileInfo(uid: string, displayName: string, photoURL: string): Promise<void> {
    await this.updateProfile({ displayName, photoURL });
  },

  // Cập nhật một hoặc nhiều trường trong hồ sơ qua REST API
  async updateProfile(updateData: any): Promise<UserProfile> {
    const res = await fetch("/api/v1/auth/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật hồ sơ thất bại");
    }

    const result = await res.json();
    return {
      ...result.user,
      uid: result.user._id,
    };
  },

  async getCompanyDriveConfig(companyCode: string): Promise<{
    companyCode: string;
    companyName: string;
    driveFolderLink: string;
    driveConnected: boolean;
    driveConnectedEmail: string;
  }> {
    const res = await fetch(`/api/v1/auth/companies/${encodeURIComponent(companyCode)}/drive`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy cấu hình Google Drive doanh nghiệp");
    }

    const result = await res.json();
    return result.data;
  },

  /** Lấy link OAuth để mở popup kết nối Google Drive. */
  async getDriveOAuthUrl(companyCode: string): Promise<string> {
    const res = await fetch(`/api/v1/auth/companies/${encodeURIComponent(companyCode)}/drive/oauth-url`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không tạo được link kết nối Google Drive");
    }

    const result = await res.json();
    return result.data.url as string;
  },

  /** Ngắt kết nối Google Drive của doanh nghiệp. */
  async disconnectCompanyDrive(companyCode: string): Promise<void> {
    const res = await fetch(`/api/v1/auth/companies/${encodeURIComponent(companyCode)}/drive/disconnect`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể ngắt kết nối Google Drive");
    }
  },

  async getTelegramLinkStatus(): Promise<TelegramLinkStatus> {
    const res = await fetch("/api/v1/auth/telegram-link", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lấy trạng thái liên kết Telegram");
    }

    const result = await res.json();
    return result.data;
  },

  async createTelegramLinkCode(): Promise<TelegramLinkStatus> {
    const res = await fetch("/api/v1/auth/telegram-link", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tạo mã liên kết Telegram");
    }

    const result = await res.json();
    return result.data;
  },

  async unlinkTelegram(): Promise<TelegramLinkStatus> {
    const res = await fetch("/api/v1/auth/telegram-link", {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể gỡ liên kết Telegram");
    }

    const result = await res.json();
    return result.data;
  },

  // Thay đổi mật khẩu người dùng qua REST API
  async changePassword(password: string): Promise<void> {
    const res = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Thay đổi mật khẩu thất bại");
    }
  },

  // Tải ảnh đại diện lên Cloudinary thông qua Relay API trên server
  async uploadAvatar(uid: string, file: File): Promise<{ url: string; uploadToken: string }> {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      const response = await fetch('/api/v1/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          file: base64Data,
          sourceType: "settings.profile",
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.url || !data.uploadToken) throw new Error("Upload ảnh đại diện không trả về token quản lý tài nguyên.");
      return { url: data.url, uploadToken: data.uploadToken };
    } catch (e) {
      console.error("[authService.uploadAvatar] Error:", e);
      throw e;
    }
  },

  // Tải file bất kỳ (mô tả công việc, tài liệu...) lên Cloudinary thông qua Relay API trên server
  async uploadFile(file: File, folder: string = "igen_erp/documents"): Promise<string> {
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      const response = await fetch('/api/v1/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          file: base64Data,
          folder,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (e) {
      console.error("[authService.uploadFile] Error:", e);
      throw e;
    }
  },

  async uploadManagedFile(file: File, sourceType: string, companyCode?: string): Promise<{ url: string; uploadToken: string }> {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
    const response = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: base64Data,
        sourceType,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        ...(companyCode ? { companyCode } : {}),
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.url || !data.uploadToken) throw new Error("Upload không trả về token quản lý tài nguyên.");
    return { url: data.url, uploadToken: data.uploadToken };
  },

  async completeManagedImport(input: {
    sourceType: string;
    uploadToken: string;
    fileName: string;
    importedCount: number;
    skippedCount?: number;
    companyCode?: string;
  }): Promise<void> {
    const response = await fetch("/api/v1/resource-imports/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || "Không thể ghi nhận file import vào quản lý tài nguyên.");
    }
  }
};
