import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { auth, db, storage } from "../config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserProfile } from "../types";

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
      });
    });
    return users;
  },

  // Cập nhật vai trò người dùng (Chỉ dành cho superadmin)
  async updateUserRole(uid: string, newRole: "user" | "admin" | "superadmin"): Promise<void> {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      role: newRole,
    });
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

