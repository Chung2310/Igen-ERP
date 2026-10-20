import React, { useState, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import {
  User,
  Calendar,
  Image as ImageIcon,
  Sliders,
  Building2,
  Shield,
  HardDrive,
  UserCheck
  , ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "./Toast";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { SETTINGS_SUB_TAB_ROUTES, type SettingsSubTabType } from "../router/subTabRoutes";
import { canManageFaces } from "../services/faceManagementService";

// Lazy-loaded subcomponents
const ProfileTab = lazy(() => import("../components/settings/ProfileTab"));
const SecurityTab = lazy(() => import("../components/settings/SecurityTab"));
const ErpConfigTab = lazy(() => import("../components/settings/ErpConfigTab"));
const GoogleDriveTab = lazy(() => import("../components/settings/GoogleDriveTab"));
const FaceRecognitionSettingsTab = lazy(() => import("../components/settings/FaceRecognitionSettingsTab"));
const BranchManagementTab = lazy(() => import("../components/settings/BranchManagementTab"));

export default function SettingsTab() {
  const subTabsRef = React.useRef<HTMLDivElement>(null);
  const scrollSubTabs = (direction: "left" | "right") => subTabsRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { userProfile, uploadAvatar } = useAuth();
  
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || "");
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [uploading, setUploading] = useState(false);

  // Sub-tabs in Settings
  const [activeSubTab, setActiveSubTab] = useSubTabRouter<SettingsSubTabType>(SETTINGS_SUB_TAB_ROUTES, "profile");
  const faceManagementAllowed = canManageFaces(userProfile);

  // Deep links to the face tab fall back to profile when unauthorized
  React.useEffect(() => {
    if (activeSubTab === "face-recognition" && !faceManagementAllowed) {
      setActiveSubTab("profile");
    }
    if (activeSubTab === "branches" && userProfile?.role !== "admin") setActiveSubTab("profile");
  }, [activeSubTab, faceManagementAllowed, userProfile?.role, setActiveSubTab]);


  // Synchronize display name and photo url from context if it updates
  React.useEffect(() => {
    if (userProfile?.displayName) {
      setDisplayName(userProfile.displayName);
    }
    if (userProfile?.photoURL) {
      setPhotoURL(userProfile.photoURL);
    }
  }, [userProfile]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp tin hình ảnh hợp lệ!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Kích thước hình ảnh không được vượt quá 5MB!");
      return;
    }

    setUploading(true);
    try {
      const downloadURL = await uploadAvatar(file);
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const getFormattedDate = () => {
    if (!userProfile?.createdAt) return "Chưa cập nhật";

    let date: Date;
    if (typeof userProfile.createdAt.toDate === "function") {
      date = userProfile.createdAt.toDate();
    } else if (userProfile.createdAt.seconds) {
      date = new Date(userProfile.createdAt.seconds * 1000);
    } else {
      date = new Date(userProfile.createdAt);
    }

    if (isNaN(date.getTime())) {
      return "Chưa cập nhật";
    }

    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formattedDate = getFormattedDate();

  return (
    <div className="h-full flex flex-col font-sans overflow-y-auto pr-2 pb-5" id="settings_tab_container">

      {/* Title Header with Glassmorphism Header */}
      <div className="mb-4 flex flex-col justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:gap-4 sm:p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-brand-primary">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-medium tracking-tight text-slate-900 sm:text-xl">
              Cài đặt Hệ thống & Cá nhân
            </h1>
            <p className="text-xs font-normal text-slate-500">Tùy chỉnh thông tin tài khoản, bảo mật và kết nối ERP</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 select-none">
          <button type="button" aria-label="Cuộn tab cài đặt sang trái" onClick={() => scrollSubTabs("left")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={subTabsRef} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto select-none">
            {[
              { id: "profile", label: "Hồ sơ cá nhân", icon: User },
              { id: "security", label: "Bảo mật", icon: Shield },
              { id: "erp", label: "Cấu hình ERP", icon: Sliders },
              { id: "google-drive", label: "Google Drive", icon: HardDrive },
              ...(faceManagementAllowed
                ? [{ id: "face-recognition", label: "Nhận diện khuôn mặt", icon: UserCheck }]
                : []),
              ...(userProfile?.role === "admin" ? [{ id: "branches", label: "Chi nhánh", icon: Building2 }] : []),
            ].map((tab) => {
              const isActive = activeSubTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as SettingsSubTabType)}
                    className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-sky-50 hover:text-brand-primary"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Cuộn tab cài đặt sang phải" onClick={() => scrollSubTabs("right")} className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 sm:hidden"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Main Settings Body Grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">

        {/* Left Column: Quick Profile Card */}
        <div className={`relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-white p-4 text-center shadow-sm sm:p-5 ${
          activeSubTab !== "profile" ? "hidden lg:flex" : "flex"
        }`}>
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-500 to-cyan-500" />

          <div className="group relative mt-7 cursor-pointer" onClick={handleAvatarClick}>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            {uploading ? (
              <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-slate-100 shadow-md">
                <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="relative z-10 h-20 w-20 rounded-full border-4 border-white object-cover shadow-md transition-opacity group-hover:opacity-90"
              />
            ) : (
              <div className="relative z-10 flex h-20 w-20 select-none items-center justify-center rounded-full border-4 border-white bg-teal-600 text-2xl font-medium text-white shadow-md transition-colors group-hover:bg-teal-700">
                {displayName.slice(0, 2).toUpperCase() || "AD"}
              </div>
            )}
            <div className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-sky-100 bg-white shadow-sm transition-transform group-hover:scale-105">
              <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
            </div>
          </div>

          <div className="relative z-10 mt-1 space-y-1">
            <h3 className="text-sm font-medium text-slate-800">{displayName}</h3>
            <p className="text-xs font-normal text-slate-500">{userProfile?.email}</p>
            <div className="pt-2 flex justify-center">
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider ${userProfile?.role === "superadmin"
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : userProfile?.role === "admin"
                  ? "bg-amber-50 border-amber-200 text-amber-600"
                  : "bg-slate-50 border-slate-200 text-slate-600"
                }`}>
                Quyền hạn: {userProfile?.role}
              </span>
            </div>
          </div>

          <div className="mt-1 w-full space-y-3 border-t border-slate-100 pt-3 text-left text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="h-4 w-4" />
                Ngày tham gia
              </span>
              <span className="font-medium text-slate-700">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Settings Forms */}
        <div className="space-y-4 lg:col-span-2">
          <Suspense fallback={<TabLoader label="Đang tải cấu hình..." />}>
            {activeSubTab === "profile" && <ProfileTab />}
            {activeSubTab === "security" && <SecurityTab />}
            {activeSubTab === "erp" && <ErpConfigTab />}
            {activeSubTab === "google-drive" && <GoogleDriveTab />}
            {activeSubTab === "face-recognition" && faceManagementAllowed && <FaceRecognitionSettingsTab />}
            {activeSubTab === "branches" && userProfile?.role === "admin" && <BranchManagementTab />}
          </Suspense>
        </div>

      </div>

    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-150 p-6 text-center">
      <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
    </div>
  );
}
