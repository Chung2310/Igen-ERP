import React, { useState, useEffect } from "react";
import { Sliders, Bell, MapPin, GraduationCap } from "lucide-react";
import { ModuleNavigationButton } from "../common/ModuleNavigation";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { useAuth } from "../../context/AuthContext";
import StudentManagementErpSettings from "./StudentManagementErpSettings";
import CompanySmtpSettingsTab from "./CompanySmtpSettingsTab";
import CompanyPaymentSettingsTab from "./CompanyPaymentSettingsTab";

export default function ErpConfigTab() {
  const { userProfile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "companyModules" >("general");

  // States for timekeeping location setup
  const [addressName, setAddressName] = useState("");
  const [latitude, setLatitude] = useState<number | "">("");
  const [longitude, setLongitude] = useState<number | "">("");
  const [allowedRadius, setAllowedRadius] = useState<number | "">("");
  const [checkInLimit, setCheckInLimit] = useState("08:30");
  const [checkOutLimit, setCheckOutLimit] = useState("17:30");
  const [lunchBreakStart, setLunchBreakStart] = useState("12:00");
  const [lunchBreakEnd, setLunchBreakEnd] = useState("13:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [annualLeaveDays, setAnnualLeaveDays] = useState(12);
  const [isLocating, setIsLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);



  // Cấu hình vị trí chấm công (GPS) dành cho admin/superadmin hoặc role được cấp quyền timekeeping:manage
  const canManageLocation =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    hasPermission("timekeeping:manage");
  // Doanh nghiệp xem các module đã được kích hoạt.
  const canViewStudentSettings =
    userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canManageSmtp = hasPermission("settings:manage");
  const canManageCompanyModules = canViewStudentSettings || canManageSmtp || hasPermission("settings:manage");

  useEffect(() => {
    if (canManageLocation) {
      const fetchCompanyLocation = async () => {
        try {
          const res = await fetch("/api/v1/timekeeping/company-location", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          });
          if (res.ok) {
            const result = await res.json();
            if (result.data) {
              setAddressName(result.data.addressName || "");
              setLatitude(result.data.latitude ?? "");
              setLongitude(result.data.longitude ?? "");
              setAllowedRadius(result.data.allowedRadius ?? "");
              setCheckInLimit(result.data.checkInLimit || "08:30");
              setCheckOutLimit(result.data.checkOutLimit || "17:30");
              setLunchBreakStart(result.data.lunchBreakStart || "12:00");
              setLunchBreakEnd(result.data.lunchBreakEnd || "13:00");
              setWorkingDays(Array.isArray(result.data.workingDays) && result.data.workingDays.length ? result.data.workingDays : [1, 2, 3, 4, 5]);
              setAnnualLeaveDays(Number(result.data.annualLeaveDays ?? 12));
            }
          }
        } catch (err) {
          console.error("Lỗi khi tải vị trí công ty:", err);
        }
      };
      fetchCompanyLocation();
    }
  }, [canManageLocation]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
        toast.success("Đã lấy tọa độ định vị GPS hiện tại!");
      },
      () => {
        setIsLocating(false);
        toast.error("Không thể tự động lấy vị trí hiện tại. Vui lòng nhập tọa độ thủ công.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (latitude === "" || longitude === "" || allowedRadius === "") {
      toast.error("Vui lòng điền đầy đủ thông tin tọa độ và bán kính.");
      return;
    }

    if (workingDays.length === 0) { toast.error("Vui lòng chọn ít nhất một ngày làm việc."); return; }

    setSavingLocation(true);
    try {
      const res = await fetch("/api/v1/timekeeping/company-location", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          allowedRadius: Number(allowedRadius),
          addressName,
          checkInLimit,
          checkOutLimit,
          lunchBreakStart,
          lunchBreakEnd,
          workingDays,
          annualLeaveDays,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Cấu hình vị trí chấm công công ty thành công!");
      } else {
        toast.error(result.message || "Lưu cấu hình thất bại.");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi kết nối khi gửi dữ liệu cấu hình."));
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <section className="settings-erp-card space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      {/* Tab bar nội bộ của Cấu hình ERP */}
      {(canManageLocation || canManageCompanyModules) && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-outline-variant pb-3 no-scrollbar" aria-label="Mục cấu hình ERP">
          <ModuleNavigationButton
            active={activeTab === "general"}
            icon={<Sliders className="size-4" />}
            onClick={() => setActiveTab("general")}
          >
            Cấu hình chung
          </ModuleNavigationButton>
          {canManageCompanyModules && (
            <ModuleNavigationButton
              active={activeTab === "companyModules"}
              icon={<GraduationCap className="size-4" />}
              onClick={() => setActiveTab("companyModules")}
            >
              Học viên & Email
            </ModuleNavigationButton>
          )}
        </div>
      )}


      {/* Preferences Section */}
      {activeTab === "companyModules" && canManageCompanyModules && (
        <div className="space-y-3">
          {canViewStudentSettings && <StudentManagementErpSettings />}
          {hasPermission("settings:manage") && <CompanyPaymentSettingsTab />}
          {canManageSmtp && <CompanySmtpSettingsTab />}
        </div>
      )}
      {activeTab === "general" && (
      <>
      <div>
        <h2 className="mb-3 flex items-center gap-2 border-b border-outline-variant pb-3 text-balance text-sm font-semibold text-on-surface">
          <Sliders className="h-4 w-4 text-brand-primary" />
          Cài đặt hiển thị & Thông báo
        </h2>

        <div className="space-y-3">
          {/* Dark Mode toggle has been moved to the global top Header bar */}

          {/* Email notification toggle */}
          <div className="flex items-center gap-3 rounded-md border border-outline-variant bg-surface p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h3 className="text-balance text-sm font-medium text-on-surface">Nhận thông báo qua Email</h3>
                <p className="mt-0.5 text-pretty text-xs text-on-surface-variant">Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.</p>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Cấu hình Vị trí Chấm công (GPS) — chỉ admin/superadmin */}
      {canManageLocation && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 border-b border-outline-variant pb-3 text-balance text-sm font-semibold text-on-surface">
            <MapPin className="h-4 w-4 text-brand-primary" />
            Cấu hình Vị trí Chấm công (GPS)
          </h2>

          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-left md:col-span-2">
                <label htmlFor="settings-location-name" className="block text-xs font-medium text-on-surface-variant">Tên địa điểm / Văn phòng</label>
                <input
                  id="settings-location-name"
                  type="text"
                  value={addressName}
                  onChange={(e) => setAddressName(e.target.value)}
                  placeholder="Ví dụ: Văn phòng đại diện TP.HCM"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-latitude" className="block text-xs font-medium text-on-surface-variant">Vĩ độ (Latitude)</label>
                <input
                  id="settings-latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="10.7769"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-longitude" className="block text-xs font-medium text-on-surface-variant">Kinh độ (Longitude)</label>
                <input
                  id="settings-longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="106.7009"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-radius" className="block text-xs font-medium text-on-surface-variant">Bán kính cho phép (mét)</label>
                <input
                  id="settings-radius"
                  type="number"
                  value={allowedRadius}
                  onChange={(e) => setAllowedRadius(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="150"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-checkin" className="block text-xs font-medium text-on-surface-variant">Giờ giới hạn Check-in (Vào)</label>
                <input
                  id="settings-checkin"
                  type="text"
                  value={checkInLimit}
                  onChange={(e) => setCheckInLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 08:30)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-checkout" className="block text-xs font-medium text-on-surface-variant">Giờ giới hạn Check-out (Ra)</label>
                <input
                  id="settings-checkout"
                  type="text"
                  value={checkOutLimit}
                  onChange={(e) => setCheckOutLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 17:30)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-lunch-start" className="block text-xs font-medium text-on-surface-variant">Bắt đầu nghỉ trưa</label>
                <input
                  id="settings-lunch-start"
                  type="text"
                  value={lunchBreakStart}
                  onChange={(e) => setLunchBreakStart(e.target.value)}
                  placeholder="HH:MM (ví dụ: 12:00)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="settings-lunch-end" className="block text-xs font-medium text-on-surface-variant">Kết thúc nghỉ trưa</label>
                <input
                  id="settings-lunch-end"
                  type="text"
                  value={lunchBreakEnd}
                  onChange={(e) => setLunchBreakEnd(e.target.value)}
                  placeholder="HH:MM (ví dụ: 13:00)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-2 text-left md:col-span-2">
                <p className="text-xs font-medium text-on-surface-variant">Ngày làm việc để lên lịch quy trình</p>
                <div className="flex flex-wrap gap-2">
                  {[{ day: 1, label: "T2" }, { day: 2, label: "T3" }, { day: 3, label: "T4" }, { day: 4, label: "T5" }, { day: 5, label: "T6" }, { day: 6, label: "T7" }, { day: 0, label: "CN" }].map(({ day, label }) => (
                    <label key={day} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-sky-50">
                      <input type="checkbox" className="accent-[#00adfc]" checked={workingDays.includes(day)} onChange={() => setWorkingDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs leading-5 text-slate-500">Các bước trong quy trình sẽ tự động bỏ qua các ngày không được chọn. Hãy chọn Thứ Bảy và/hoặc Chủ Nhật nếu công ty của bạn làm việc vào những ngày đó.</p>
              </div>

              <div className="flex items-end justify-start">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-sm font-medium text-brand-primary transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4" />
                  {isLocating ? "Đang xác định..." : "Lấy vị trí hiện tại của tôi"}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingLocation}
                className="h-9 cursor-pointer rounded-xl bg-brand-primary px-4 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingLocation ? "Đang lưu cấu hình..." : "Lưu Cấu hình"}
              </button>
            </div>
          </form>
        </div>
      )}
      </>
      )}
    </section>
  );
}
