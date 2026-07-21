import React, { useState, useEffect } from "react";
import { Sliders, Bell, MapPin } from "lucide-react";
import { toast } from "../../pages/Toast";
import { useAuth } from "../../context/AuthContext";
import EmployeeWorkHoursTab from "./EmployeeWorkHoursTab";
import CompanyWorkCalendarTab from "./CompanyWorkCalendarTab";

export default function ErpConfigTab() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "workHours" | "workCalendar">("general");

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
  const [isLocating, setIsLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);



  // Cấu hình vị trí chấm công (GPS) chỉ dành cho admin/superadmin xem & sửa
  const canManageLocation = userProfile?.role === "superadmin" || userProfile?.role === "admin";


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
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Cấu hình vị trí chấm công công ty thành công!");
      } else {
        toast.error(result.message || "Lưu cấu hình thất bại.");
      }
    } catch {
      toast.error("Lỗi kết nối khi gửi dữ liệu cấu hình.");
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Tab bar nội bộ của Cấu hình ERP */}
      {canManageLocation && (
        <div className="flex gap-2 border-b border-gray-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === "general" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Cấu hình chung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workCalendar")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === "workCalendar" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Lịch nghỉ lễ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workHours")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === "workHours" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Giờ làm việc nhân viên
          </button>
        </div>
      )}

      {activeTab === "workHours" && canManageLocation && <EmployeeWorkHoursTab />}
      {activeTab === "workCalendar" && canManageLocation && <CompanyWorkCalendarTab />}

      {/* Preferences Section */}
      {activeTab === "general" && (
      <>
      <div>
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
          <Sliders className="h-5 w-5 text-purple-500" />
          Cài đặt hiển thị & Thông báo
        </h3>

        <div className="space-y-4">
          {/* Dark Mode toggle has been moved to the global top Header bar */}

          {/* Email notification toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-gray-800">Nhận thông báo qua Email</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Nhận các báo cáo tóm tắt hàng ngày qua email đăng ký.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">

              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>
      </div>



      {/* Cấu hình Vị trí Chấm công (GPS) — chỉ admin/superadmin */}
      {canManageLocation && (
        <div>
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
            <MapPin className="h-5 w-5 text-indigo-500" />
            Cấu hình Vị trí Chấm công (GPS)
          </h3>

          <form onSubmit={handleSaveLocation} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tên địa điểm / Văn phòng</label>
                <input
                  type="text"
                  value={addressName}
                  onChange={(e) => setAddressName(e.target.value)}
                  placeholder="Ví dụ: Văn phòng đại diện TP.HCM"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Vĩ độ (Latitude)</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="10.7769"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kinh độ (Longitude)</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="106.7009"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Bán kính cho phép (mét)</label>
                <input
                  type="number"
                  value={allowedRadius}
                  onChange={(e) => setAllowedRadius(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="150"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Giờ giới hạn Check-in (Vào)</label>
                <input
                  type="text"
                  value={checkInLimit}
                  onChange={(e) => setCheckInLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 08:30)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Giờ giới hạn Check-out (Ra)</label>
                <input
                  type="text"
                  value={checkOutLimit}
                  onChange={(e) => setCheckOutLimit(e.target.value)}
                  placeholder="HH:MM (ví dụ: 17:30)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Bắt đầu nghỉ trưa</label>
                <input
                  type="text"
                  value={lunchBreakStart}
                  onChange={(e) => setLunchBreakStart(e.target.value)}
                  placeholder="HH:MM (ví dụ: 12:00)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kết thúc nghỉ trưa</label>
                <input
                  type="text"
                  value={lunchBreakEnd}
                  onChange={(e) => setLunchBreakEnd(e.target.value)}
                  placeholder="HH:MM (ví dụ: 13:00)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-2 text-left md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ngày làm việc để lên lịch quy trình</label>
                <div className="flex flex-wrap gap-2">
                  {[{ day: 1, label: "T2" }, { day: 2, label: "T3" }, { day: 3, label: "T4" }, { day: 4, label: "T5" }, { day: 5, label: "T6" }, { day: 6, label: "T7" }, { day: 0, label: "CN" }].map(({ day, label }) => (
                    <label key={day} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={workingDays.includes(day)} onChange={() => setWorkingDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500">Các bước trong quy trình sẽ tự động bỏ qua các ngày không được chọn. Hãy chọn Thứ Bảy và/hoặc Chủ Nhật nếu công ty của bạn làm việc vào những ngày đó.</p>
              </div>

              <div className="flex items-end justify-start">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="px-4 py-2 border border-indigo-200 hover:border-indigo-500 rounded-xl text-xs font-semibold text-indigo-650 hover:bg-indigo-50/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4" />
                  {isLocating ? "Đang xác định..." : "Lấy vị trí hiện tại của tôi"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingLocation}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/10 active:scale-[0.98] cursor-pointer disabled:opacity-50"
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
