import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  User, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../config/firebase";
import { authService } from "../services/authService";
import { UserProfile, FacebookIntegration } from "../types";
import { toast } from "../components/Toast";

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
  saveFacebookIntegration: (integration: FacebookIntegration) => Promise<void>;
  removeFacebookIntegration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let isSeeding = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (uid: string, currentUser?: User) => {
    try {
      let profile = await authService.getUserProfile(uid);
      if (!profile && currentUser) {
        console.log("iGen ERP: Hồ sơ chưa tồn tại trên Firestore. Tự động tạo hồ sơ mặc định...");
        
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || "User",
          photoURL: currentUser.photoURL || "",
          role: "user",
          createdAt: new Date(),
        };

        await setDoc(doc(db, "users", currentUser.uid), {
          ...newProfile,
          createdAt: serverTimestamp(),
        });
        
        profile = newProfile;
      }
      setUserProfile(profile);
    } catch (error) {
      console.error("Lỗi khi tải hoặc tạo hồ sơ người dùng:", error);
      setUserProfile(null);
    }
  };

  const checkAndSeedSuperAdmin = async () => {
    const saEmail = import.meta.env.VITE_SUPERADMIN_EMAIL;
    const saPassword = import.meta.env.VITE_SUPERADMIN_PASSWORD;
    const saName = import.meta.env.VITE_SUPERADMIN_NAME || "Super Admin";

    if (!saEmail || !saPassword) return;
    if (isSeeding) return;

    isSeeding = true;
    try {
      const usersCol = collection(db, "users");
      
      // 1. Kiểm tra xem ĐÃ CÓ tài khoản superadmin nào trong hệ thống chưa
      const saQuery = query(usersCol, where("role", "==", "superadmin"));
      const saSnapshot = await getDocs(saQuery);

      if (!saSnapshot.empty) {
        // Nếu có nhiều hơn 1 tài khoản superadmin, tự động hạ cấp các tài khoản thừa
        if (saSnapshot.size > 1) {
          console.log(`iGen ERP Auto-Seeder: Phát hiện ${saSnapshot.size} tài khoản Super Admin. Tiến hành hạ cấp bớt...`);
          
          // Xác định tài khoản nào sẽ được giữ làm Super Admin duy nhất (ưu tiên trùng email cấu hình)
          let mainSaDoc = saSnapshot.docs.find(d => d.data().email === saEmail.trim());
          if (!mainSaDoc) {
            mainSaDoc = saSnapshot.docs[0];
          }

          // Hạ cấp các tài khoản superadmin còn lại xuống "admin"
          for (const saDoc of saSnapshot.docs) {
            if (saDoc.id !== mainSaDoc.id) {
              console.log(`iGen ERP Auto-Seeder: Hạ cấp tài khoản dư thừa: ${saDoc.data().email} xuống admin`);
              await updateDoc(doc(db, "users", saDoc.id), {
                role: "admin"
              });
            }
          }
          console.log("iGen ERP Auto-Seeder: Đã dọn dẹp xong, chỉ giữ lại duy nhất 1 tài khoản Super Admin.");
        } else {
          console.log("iGen ERP Auto-Seeder: Hệ thống đã có tài khoản Super Admin duy nhất. Bỏ qua seeding.");
        }
        isSeeding = false;
        return;
      }

      // 2. Nếu chưa có bất kỳ Super Admin nào, tiến hành seed
      const emailQuery = query(usersCol, where("email", "==", saEmail.trim()));
      const emailSnapshot = await getDocs(emailQuery);

      if (emailSnapshot.empty) {
        console.log("iGen ERP Auto-Seeder: Khởi tạo tài khoản Super Admin...");
        const userCredential = await createUserWithEmailAndPassword(auth, saEmail.trim(), saPassword.trim());
        const user = userCredential.user;

        await updateProfile(user, { displayName: saName });

        const userProfile: UserProfile = {
          uid: user.uid,
          email: saEmail.trim(),
          displayName: saName,
          photoURL: "",
          role: "superadmin",
          createdAt: new Date(),
        };

        await setDoc(doc(db, "users", user.uid), {
          ...userProfile,
          createdAt: serverTimestamp(),
        });
        console.log("iGen ERP Auto-Seeder: Đã seed tài khoản Super Admin thành công!");
      } else {
        // Nâng cấp tài khoản trùng email lên superadmin nếu hệ thống chưa có ai là superadmin
        const existingUserDoc = emailSnapshot.docs[0];
        console.log(`iGen ERP Auto-Seeder: Nâng cấp tài khoản ${saEmail} lên Super Admin...`);
        await updateDoc(doc(db, "users", existingUserDoc.id), {
          role: "superadmin"
        });
        console.log("iGen ERP Auto-Seeder: Đã nâng cấp thành công!");
      }
    } catch (error) {
      console.error("iGen ERP Auto-Seeder: Lỗi khi tự động seed Super Admin:", error);
    } finally {
      isSeeding = false;
    }
  };

  useEffect(() => {
    const seedAndListen = async () => {
      await checkAndSeedSuperAdmin();
    };
    seedAndListen();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid, currentUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const applyPersistence = async (rememberMe?: boolean) => {
    try {
      const mode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, mode);
    } catch (error) {
      console.error("Lỗi cấu hình lưu trữ phiên đăng nhập:", error);
    }
  };

  const loginWithEmail = async (email: string, password: string, rememberMe: boolean = true) => {
    setLoading(true);
    try {
      await applyPersistence(rememberMe);
      await authService.loginWithEmail(email, password);
      toast.success("Đăng nhập tài khoản thành công!");
    } catch (error: any) {
      let msg = "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        msg = "Email hoặc mật khẩu không chính xác.";
      } else if (error.code === "auth/invalid-email") {
        msg = "Địa chỉ email không đúng định dạng.";
      }
      toast.error(msg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string, rememberMe: boolean = true) => {
    setLoading(true);
    try {
      await applyPersistence(rememberMe);
      await authService.registerWithEmail(email, password, displayName);
      toast.success("Tạo tài khoản và đăng nhập thành công!");
    } catch (error: any) {
      let msg = "Đăng ký thất bại. Vui lòng thử lại.";
      if (error.code === "auth/email-already-in-use") {
        msg = "Địa chỉ email này đã được đăng ký sử dụng.";
      } else if (error.code === "auth/weak-password") {
        msg = "Mật khẩu quá yếu (phải chứa ít nhất 6 ký tự).";
      }
      toast.error(msg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (rememberMe: boolean = true) => {
    setLoading(true);
    try {
      await applyPersistence(rememberMe);
      await authService.loginWithGoogle();
      toast.success("Đăng nhập bằng Google thành công!");
    } catch (error: any) {
      console.error(error);
      toast.error("Đăng nhập Google thất bại hoặc bị hủy bỏ.");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      // Xóa thông tin lưu trữ local và cookies
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      toast.success("Đã đăng xuất tài khoản thành công!");
    } catch (error) {
      toast.error("Lỗi khi đăng xuất.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfileInfo = async (displayName: string, photoURL: string) => {
    if (!user) return;
    try {
      await authService.updateProfileInfo(user.uid, displayName, photoURL);
      await fetchProfile(user.uid);
      toast.success("Cập nhật thông tin tài khoản thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Cập nhật thông tin thất bại.");
      throw error;
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error("Chưa đăng nhập");
    try {
      const downloadURL = await authService.uploadAvatar(user.uid, file);
      await authService.updateProfileInfo(user.uid, userProfile?.displayName || user.displayName || "User", downloadURL);
      await fetchProfile(user.uid);
      toast.success("Tải lên ảnh đại diện thành công!");
      return downloadURL;
    } catch (error) {
      console.error("Lỗi upload avatar:", error);
      toast.error("Tải lên ảnh đại diện thất bại.");
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const saveFacebookIntegration = async (integration: FacebookIntegration) => {
    if (!user) return;
    const finalIntegration = { ...integration };

    try {
      if (!integration.isMock) {
        console.log("[iGen FB Connect] Đang gửi yêu cầu xác thực tới Cloud Function...", {
          pageId: integration.pageId,
          tokenLength: integration.pageAccessToken?.length
        });
        
        const validateFn = httpsCallable<
          { pageId: string; pageAccessToken: string },
          { valid: boolean; pageName: string }
        >(functions, 'validateFacebookToken');

        const result = await validateFn({
          pageId: integration.pageId,
          pageAccessToken: integration.pageAccessToken
        });
        
        console.log("[iGen FB Connect] Xác thực thành công từ Meta API:", result.data);
        finalIntegration.pageName = result.data.pageName;
      }

      console.log("[iGen FB Connect] Đang cập nhật Firestore cho user:", user.uid, finalIntegration);
      await updateDoc(doc(db, "users", user.uid), {
        facebookIntegration: finalIntegration
      });
      setUserProfile((prev) => prev ? { ...prev, facebookIntegration: finalIntegration } : null);
      toast.success("Kết nối Facebook Page thành công!");
    } catch (error: any) {
      console.error("[iGen FB Connect] Gặp lỗi nghiêm trọng hoặc xác thực thất bại:", error);
      const errMsg = error?.message || error?.details || "Không thể kết nối và xác thực với Facebook Page. Vui lòng kiểm tra lại ID và Token.";
      toast.error(errMsg);
      throw error;
    }
  };

  const removeFacebookIntegration = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        facebookIntegration: null
      });
      setUserProfile((prev) => prev ? { ...prev, facebookIntegration: null } : null);
      toast.success("Đã hủy liên kết Facebook Page.");
    } catch (error) {
      console.error("Lỗi xóa Facebook integration:", error);
      toast.error("Lỗi khi hủy liên kết Facebook.");
      throw error;
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
        saveFacebookIntegration,
        removeFacebookIntegration,
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
