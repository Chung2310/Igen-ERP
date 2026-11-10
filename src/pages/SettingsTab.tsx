import React, { useState, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import {
  User,
  Calendar,
  Image as ImageIcon,
  Sliders,
  UserCheck
} from "lucide-react";
import { toast } from "./Toast";
import { ModuleNavigation, ModuleNavigationButton } from "../components/common/ModuleNavigation";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { SETTINGS_SUB_TAB_ROUTES, type SettingsSubTabType } from "../router/subTabRoutes";
import { canManageFaces } from "../services/faceManagementService";
import { cn } from "../modules/student-management/lib/utils";
import "./settings-tab.css";

// Lazy-loaded subcomponents
const ProfileTab = lazy(() => import("../components/settings/ProfileTab"));
const SecurityTab = lazy(() => import("../components/settings/SecurityTab"));
const ErpConfigTab = lazy(() => import("../components/settings/ErpConfigTab"));
const FaceRecognitionSettingsTab = lazy(() => import("../components/settings/FaceRecognitionSettingsTab"));

export default function SettingsTab() {
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
  }, [activeSubTab, faceManagementAllowed, setActiveSubTab]);


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
    <div className="flex h-full min-h-0 flex-col bg-surface font-sans" id="settings_tab_container">
      <ModuleNavigation label="Mục Cài đặt" activeValue={activeSubTab} className="mb-2 lg:mb-0">
        {[
          { id: "profile", label: "Hồ sơ cá nhân", icon: User },
          { id: "erp", label: "Cấu hình ERP", icon: Sliders },
          ...(faceManagementAllowed ? [{ id: "face-recognition", label: "Nhận diện khuôn mặt", icon: UserCheck }] : []),
        ].map(tab => <ModuleNavigationButton key={tab.id} active={activeSubTab === tab.id} icon={<tab.icon />} onClick={() => setActiveSubTab(tab.id as SettingsSubTabType)}>{tab.label}</ModuleNavigationButton>)}
      </ModuleNavigation>

      <div className="settings-workspace min-h-0 flex-1 overflow-y-auto">
        <section className="settings-content-card min-h-full rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <div className={cn("grid grid-cols-1 items-start gap-3", activeSubTab === "profile" && "lg:grid-cols-3")}>

        {/* Left Column: Quick Profile Card */}
        <div className={`relative flex flex-col items-center gap-3 overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-center shadow-sm sm:p-5 ${
          activeSubTab !== "profile" ? "hidden" : "flex"
        }`}>
          <div className="absolute inset-x-0 top-0 h-16 bg-primary/10" />

          <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              tabIndex={-1}
              aria-label="Chọn ảnh đại diện"
              accept="image/*"
              onChange={handleFileChange}
            />
          <button type="button" className="group relative mt-6 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={handleAvatarClick} aria-label="Thay ảnh đại diện" disabled={uploading}>
            {uploading ? (
              <div className="relative z-10 flex size-20 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-surface shadow-sm">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="relative z-10 size-20 rounded-full border-4 border-surface-container-lowest object-cover shadow-sm group-hover:opacity-90"
              />
            ) : (
              <div className="relative z-10 flex size-20 select-none items-center justify-center rounded-full border-4 border-surface-container-lowest bg-primary text-2xl font-semibold text-on-primary shadow-sm">
                {displayName.slice(0, 2).toUpperCase() || "AD"}
              </div>
            )}
            <div className="absolute bottom-0 right-0 z-20 flex size-7 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest shadow-sm">
              <ImageIcon className="size-3.5 text-on-surface-variant" />
            </div>
          </button>

          <div className="relative z-10 mt-1 space-y-1">
            <h2 className="text-balance text-sm font-semibold text-on-surface">{displayName}</h2>
            <p className="break-all text-xs text-on-surface-variant">{userProfile?.email}</p>
            <div className="pt-2 flex justify-center">
              <span className="rounded-md border border-outline-variant bg-surface px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                Quyền hạn: {userProfile?.role}
              </span>
            </div>
          </div>

          <div className="mt-1 w-full space-y-3 border-t border-outline-variant pt-3 text-left text-xs text-on-surface-variant">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-on-surface-variant">
                <Calendar className="h-4 w-4" />
                Ngày tham gia
              </span>
              <span className="font-medium tabular-nums text-on-surface">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Settings Forms */}
        <div className={cn("min-w-0 space-y-3", activeSubTab === "profile" && "lg:col-span-2")}>
          <Suspense fallback={<TabLoader label="Đang tải cấu hình..." />}>
            {activeSubTab === "profile" && <><ProfileTab /><SecurityTab /></>}
            {activeSubTab === "erp" && <ErpConfigTab />}
            {activeSubTab === "face-recognition" && faceManagementAllowed && <FaceRecognitionSettingsTab />}
          </Suspense>
        </div>

          </div>
        </section>
      </div>
    </div>
  );
}

function TabLoader({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-6 text-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
    </div>
  );
}
