import React, { useState, useEffect } from "react";
import { Sliders, Bell, MapPin, GraduationCap } from "lucide-react";
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

    if (workingDays.length === 0) { toast.error("Please select at least one working day."); return; }

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
    <div className="space-y-5 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
      {/* Tab bar nội bộ của Cấu hình ERP */}
      {(canManageLocation || canManageCompanyModules) && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 pb-3 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "general" ? "bg-brand-primary text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-brand-primary"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Cấu hình chung
          </button>
          {canManageCompanyModules && (
            <button type="button" onClick={() => setActiveTab("companyModules")}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${activeTab === "companyModules" ? "bg-brand-primary text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-brand-primary"}`}>
              <GraduationCap className="h-3.5 w-3.5" />
              Học viên & Email
            </button>
          )}
        </div>
      )}


      {/* Preferences Section */}
      {activeTab === "companyModules" && canManageCompanyModules && (
        <div className="space-y-5">
          {canViewStudentSettings && <StudentManagementErpSettings />}
          {hasPermission("settings:manage") && <CompanyPaymentSettingsTab />}
          {canManageSmtp && <CompanySmtpSettingsTab />}
        </div>
      )}
      {activeTab === "general" && (
      <>
      <div>
        <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-medium text-slate-800">
          <Sliders className="h-4 w-4 text-brand-primary" />
          Cài đặt hiển thị & Thông báo
        </h3>

        <div className="space-y-4">
          {/* Dark Mode toggle has been moved to the global top Header bar */}

          {/* Email notification toggle */}
          <div className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-sky-50/50">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-50 p-2 text-brand-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-medium text-slate-800">Nhận thông báo qua Email</h4>
                <p className="mt-0.5 text-xs text-slate-500">Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">

              <div className="w-9 h-5 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-focus:outline-none peer-checked:bg-brand-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        </div>
      </div>



      {/* Cấu hình Vị trí Chấm công (GPS) — chỉ admin/superadmin */}
      {canManageLocation && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-medium text-slate-800">
            <MapPin className="h-4 w-4 text-brand-primary" />
            Cấu hình Vị trí Chấm công (GPS)
          </h3>

          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-left md:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Tên địa điểm / Văn phòng</label>
                <input
                  type="text"
                  value={addressName}
                  onChange={(e) => setAddressName(e.target.value)}
                  placeholder="Ví dụ: Văn phòng đại diện TP.HCM"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-600">Vĩ độ (Latitude)</label>
                <input
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
                <label className="block text-xs font-medium text-slate-600">Kinh độ (Longitude)</label>
                <input
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
                <label className="block text-xs font-medium text-slate-600">Bán kính cho phép (mét)</label>
                <input
                  type="number"
                  value={allowedRadius}
                  onChange={(e) => setAllowedRadius(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="150"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-600">Giờ giới hạn Check-in (Vào)</label>
                <input
                  type="text"
                  value={checkInLimit}
                  onChange={(e) => setCheckInLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 08:30)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-600">Giờ giới hạn Check-out (Ra)</label>
                <input
                  type="text"
                  value={checkOutLimit}
                  onChange={(e) => setCheckOutLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 17:30)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-600">Bắt đầu nghỉ trưa</label>
                <input
                  type="text"
                  value={lunchBreakStart}
                  onChange={(e) => setLunchBreakStart(e.target.value)}
                  placeholder="HH:MM (ví dụ: 12:00)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-600">Kết thúc nghỉ trưa</label>
                <input
                  type="text"
                  value={lunchBreakEnd}
                  onChange={(e) => setLunchBreakEnd(e.target.value)}
                  placeholder="HH:MM (ví dụ: 13:00)"
                  className="mt-1.5 h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div className="space-y-2 text-left md:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Ngày làm việc để lên lịch quy trình</label>
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
    </div>
  );
}
