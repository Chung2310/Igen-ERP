import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile,
  getAuth
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  where,
  serverTimestamp
} from "firebase/firestore";
import { auth, db, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserProfile, CompanyProfile } from "../types";

const googleProvider = new GoogleAuthProvider();

export const authService = {
  // Đăng ký bằng Email & Mật khẩu
  async registerWithEmail(email: string, password: string, displayName: string): Promise<UserProfile> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Cập nhật profile Firebase Auth
    await updateProfile(user, { displayName });

    // Tạo hồ sơ người dùng trong Firestore với role mặc định "user"
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName: displayName || user.displayName || "User",
      photoURL: user.photoURL || "",
      role: "user",
      createdAt: new Date(),
    };

    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      ...userProfile,
      createdAt: serverTimestamp(),
    });

    return userProfile;
  },

  // Đăng nhập bằng Email & Mật khẩu
  async loginWithEmail(email: string, password: string) {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  // Đăng nhập bằng Google
  async loginWithGoogle(): Promise<UserProfile> {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;

    // Kiểm tra xem người dùng đã tồn tại trong Firestore chưa
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    } else {
      // Đăng nhập lần đầu, tạo tài khoản mặc định "user"
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "User",
        photoURL: user.photoURL || "",
        role: "user",
        createdAt: new Date(),
      };

      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
      });

      return userProfile;
    }
  },

  // Đăng xuất
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Lấy chi tiết hồ sơ người dùng từ Firestore
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(db, "users", uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin người dùng từ Firestore:", error);
      return null;
    }
  },

  // Lấy danh sách toàn bộ người dùng (Chỉ dành cho superadmin)
  async getAllUsers(): Promise<UserProfile[]> {
    const usersCol = collection(db, "users");
    const q = query(usersCol, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        uid: docSnap.id,
        email: data.email || "",
        displayName: data.displayName || "",
        photoURL: data.photoURL || "",
        role: data.role || "user",
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        companyCode: data.companyCode || "",
        companyName: data.companyName || "",
        jobTitle: data.jobTitle || "",
        department: data.department || "",
        phone: data.phone || "",
        level: data.level || 4,
        parentId: data.parentId || "",
        status: data.status || "offline",
        division: data.division || ""
      });
    });
    return users;
  },

  // Lấy danh sách người dùng theo Doanh nghiệp (Dành cho chủ doanh nghiệp/manager/staff)
  async getUsersByCompany(companyCode: string): Promise<UserProfile[]> {
    const usersCol = collection(db, "users");
    const q = query(usersCol, where("companyCode", "==", companyCode));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        uid: docSnap.id,
        email: data.email || "",
        displayName: data.displayName || "",
        photoURL: data.photoURL || "",
        role: data.role || "user",
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        companyCode: data.companyCode || "",
        companyName: data.companyName || "",
        jobTitle: data.jobTitle || "",
        department: data.department || "",
        phone: data.phone || "",
        level: data.level || 4,
        parentId: data.parentId || "",
        status: data.status || "offline",
        division: data.division || ""
      });
    });
    return users;
  },

  // Cập nhật vai trò người dùng (Chỉ dành cho superadmin)
  async updateUserRole(uid: string, newRole: "user" | "manager" | "admin" | "superadmin"): Promise<void> {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      role: newRole,
    });
  },

  // Lấy danh sách tất cả doanh nghiệp (Chỉ dành cho superadmin)
  async getAllCompanies(): Promise<CompanyProfile[]> {
    const companiesCol = collection(db, "companies");
    const q = query(companiesCol, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const companies: CompanyProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      companies.push({
        id: docSnap.id,
        code: data.code || "",
        name: data.name || "",
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        ownerEmail: data.ownerEmail || ""
      });
    });
    return companies;
  },

  // Đăng ký doanh nghiệp mới và tạo tài khoản Admin tương ứng (Chỉ dành cho superadmin)
  async registerCompanyAndAdmin(
    companyName: string,
    companyCode: string,
    ownerName: string,
    ownerEmail: string,
    ownerPassword: string
  ): Promise<void> {
    const normalizedCode = companyCode.toUpperCase().trim();
    // 1. Tạo bản ghi trong collection "companies"
    const companyDocRef = doc(db, "companies", normalizedCode);
    await setDoc(companyDocRef, {
      id: normalizedCode,
      code: normalizedCode,
      name: companyName.trim(),
      ownerEmail: ownerEmail.trim(),
      createdAt: serverTimestamp()
    });

    // 2. Tạo tài khoản admin cho doanh nghiệp bằng Firebase App phụ để tránh logout superadmin hiện tại
    const tempApp = initializeApp(auth.app.options, `TempApp_${Date.now()}`);
    const tempAuth = getAuth(tempApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, ownerEmail.trim(), ownerPassword);
      const user = userCredential.user;

      await updateProfile(user, { displayName: ownerName.trim() });

      // Lưu hồ sơ user vào Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userProfile: UserProfile = {
        uid: user.uid,
        email: ownerEmail.trim(),
        displayName: ownerName.trim(),
        photoURL: "",
        role: "admin",
        createdAt: new Date(),
        companyCode: normalizedCode,
        companyName: companyName.trim(),
        jobTitle: "Chief Executive Officer (CEO)",
        department: "Ban Giám Đốc",
        division: "Ban Giám Đốc",
        level: 1, // CEO level
        status: "offline"
      };

      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp()
      });

      await signOut(tempAuth);
    } catch (error) {
      console.error("Lỗi khi tạo tài khoản admin doanh nghiệp:", error);
      throw error;
    } finally {
      await deleteApp(tempApp);
    }
  },

  // Đăng ký người dùng mới cho doanh nghiệp (Chỉ dành cho superadmin hoặc admin)
  async registerUserForCompany(
    displayName: string,
    email: string,
    password: string,
    role: "user" | "manager" | "admin",
    companyCode: string,
    companyName: string
  ): Promise<void> {
    const normalizedCode = companyCode.toUpperCase().trim();
    // Tạo tài khoản mới bằng Firebase App phụ
    const tempApp = initializeApp(auth.app.options, `TempAppUser_${Date.now()}`);
    const tempAuth = getAuth(tempApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: displayName.trim() });

      // Lưu hồ sơ user vào Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userProfile: UserProfile = {
        uid: user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        photoURL: "👨‍💻",
        role: role,
        createdAt: new Date(),
        companyCode: normalizedCode === "SYSTEM" ? "" : normalizedCode,
        companyName: normalizedCode === "SYSTEM" ? "Hệ thống" : companyName.trim(),
        jobTitle: role === "admin" ? "Chief Executive Officer (CEO)" : (role === "manager" ? "Quản lý phòng ban" : "Nhân viên"),
        department: role === "admin" ? "Ban Giám Đốc" : (role === "manager" ? "Quản lý" : "Nhân sự"),
        division: role === "admin" ? "Ban Giám Đốc" : (role === "manager" ? "Quản lý" : "Nhân sự"),
        level: role === "admin" ? 1 : (role === "manager" ? 3 : 4),
        status: "offline"
      };

      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp()
      });

      await signOut(tempAuth);
    } catch (error) {
      console.error("Lỗi khi đăng ký tài khoản thành viên doanh nghiệp:", error);
      throw error;
    } finally {
      await deleteApp(tempApp);
    }
  },

  // Cập nhật thông tin hồ sơ cá nhân
  async updateProfileInfo(uid: string, displayName: string, photoURL: string): Promise<void> {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      displayName: displayName.trim(),
      photoURL: photoURL.trim(),
    });

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });
    }
  },

  // Tải ảnh đại diện lên Firebase Storage
  async uploadAvatar(uid: string, file: File): Promise<string> {
    const extension = file.name.split('.').pop() || 'jpg';
    const storageRef = ref(storage, `avatars/${uid}/avatar_${Date.now()}.${extension}`);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Lấy link tải về
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  }
};

