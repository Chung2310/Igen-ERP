import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  User,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";
import { BRAND_NAME, BRAND_LOGO_PATH } from "../config/brand";

interface BranchInfo {
  _id?: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
}

interface CompanyPublicData {
  companyCode: string;
  companyName: string;
  selectedBranch: BranchInfo | null;
  branches: BranchInfo[];
}

const POPULAR_SERVICES = [
  "Khám & Tư vấn tổng quát",
  "Chăm sóc & Phục hồi sức khỏe",
  "Gói khám định kỳ",
  "Tư vấn trang thiết bị y tế",
  "Dịch vụ chăm sóc tại nhà",
  "Nhu cầu khác",
];

const TIME_SLOTS = [
  "Bất kỳ lúc nào",
  "Buổi sáng (08:00 - 11:30)",
  "Buổi chiều (13:30 - 17:00)",
  "Buổi tối (sau 17:30)",
];

export default function CustomerLeadPublicForm() {
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyPublicData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [serviceInterest, setServiceInterest] = useState("Khám & Tư vấn tổng quát");
  const [customService, setCustomService] = useState("");
  const [preferredContactTime, setPreferredContactTime] = useState("Bất kỳ lúc nào");
  const [notes, setNotes] = useState("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const companyCodeParam = (searchParams.get("c") || searchParams.get("companyCode") || "COMPANY").trim();
  const branchCodeParam = (searchParams.get("b") || searchParams.get("branchCode") || "").trim();
  const campaignParam = (searchParams.get("camp") || searchParams.get("qrCampaign") || "Quét mã QR").trim();

  useEffect(() => {
    async function fetchInfo() {
      setLoadingCompany(true);
      setLoadError(null);
      try {
        const query = new URLSearchParams({
          c: companyCodeParam,
          ...(branchCodeParam ? { b: branchCodeParam } : {}),
        });
        const res = await fetch(`/api/v1/customer-leads/public/info?${query.toString()}`);
        const json = await res.json();
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Không tìm thấy thông tin đơn vị tiếp nhận.");
        }
        setCompanyData(json.data);
        if (json.data.selectedBranch?._id) {
          setSelectedBranchId(json.data.selectedBranch._id);
        } else if (json.data.branches?.length === 1) {
          setSelectedBranchId(json.data.branches[0]._id || "");
        }
      } catch (err: any) {
        setLoadError(err.message || "Có lỗi xảy ra khi tải thông tin đơn vị tiếp nhận.");
      } finally {
        setLoadingCompany(false);
      }
    }

    fetchInfo();
  }, [companyCodeParam, branchCodeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim().replace(/[\s.-]/g, "");

    if (!trimmedName || trimmedName.length < 2) {
      setSubmitError("Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).");
      return;
    }

    const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      setSubmitError("Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (ví dụ: 0912345678).");
      return;
    }

    setSubmitting(true);

    try {
      const finalService =
        serviceInterest === "Nhu cầu khác" && customService.trim()
          ? customService.trim()
          : serviceInterest;

      const payload = {
        companyCode: companyCodeParam.toUpperCase(),
        branchId: selectedBranchId || undefined,
        branchCode: branchCodeParam || undefined,
        fullName: trimmedName,
        phone: trimmedPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        serviceInterest: finalService,
        preferredContactTime,
        notes: notes.trim() || undefined,
        qrCampaign: campaignParam,
      };

      const res = await fetch("/api/v1/customer-leads/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gửi thông tin thất bại. Vui lòng thử lại!");
      }

      setSubmitSuccess(true);
      setSuccessMessage(json.message || "Gửi thông tin thành công!");
    } catch (err: any) {
      setSubmitError(err.message || "Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setCustomService("");
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  // Màn hình loading thông tin doanh nghiệp
  if (loadingCompany) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/40 p-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md shadow-teal-500/10 border border-teal-100">
          <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600">Đang khởi tạo biểu mẫu tiếp nhận thông tin...</p>
      </div>
    );
  }

  // Màn hình báo lỗi nếu mã công ty không hợp lệ
  if (loadError || !companyData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="mx-auto max-w-md rounded-3xl border border-rose-100 bg-white p-8 shadow-xl shadow-rose-500/5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">Không tìm thấy đơn vị tiếp nhận</h2>
          <p className="mt-2 text-sm text-slate-500">{loadError || "Mã liên kết hoặc mã QR không hợp lệ."}</p>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-900 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 via-slate-50 to-slate-100 py-6 px-3 sm:px-6 font-sans text-slate-800 antialiased">
      <div className="mx-auto max-w-lg">
        {/* Header thương hiệu */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white shadow-sm border border-teal-100/80 mb-3">
            <img
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              className="h-10 w-10 object-contain"
              onError={(e) => {
                // Fallback nếu ảnh không tồn tại
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="font-bold text-slate-900 tracking-tight text-base px-2">
              {companyData.companyName || BRAND_NAME}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Đăng ký Tư vấn & Dịch vụ
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Vui lòng để lại thông tin liên hệ. Đội ngũ chuyên viên sẽ liên hệ tư vấn và hỗ trợ Quý khách chu đáo nhất.
          </p>

          {/* Chi nhánh / Nguồn */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {companyData.selectedBranch ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-teal-100/80 text-teal-800 border border-teal-200">
                <Building2 className="h-3 w-3" /> Chi nhánh: {companyData.selectedBranch.name}
              </span>
            ) : null}
            {campaignParam && campaignParam !== "Quét mã QR" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-200/80 text-slate-700">
                {campaignParam}
              </span>
            )}
          </div>
        </header>

        {/* Khung nội dung chính */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-teal-900/5">
          {submitSuccess ? (
            /* Màn hình gửi thành công */
            <div className="p-6 sm:p-8 text-center space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm animate-bounce">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">Gửi thông tin thành công!</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {successMessage ||
                    "Lux Care xin chân thành cảm ơn Quý khách. Chuyên viên chăm sóc khách hàng sẽ liên hệ với Quý khách trong thời gian sớm nhất."}
                </p>
              </div>

              {/* Hộp thông tin đã ghi nhận */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Khách hàng:</span>
                  <span className="font-semibold text-slate-800">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Số điện thoại:</span>
                  <span className="font-semibold text-slate-800">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dịch vụ quan tâm:</span>
                  <span className="font-semibold text-teal-700">
                    {serviceInterest === "Nhu cầu khác" && customService ? customService : serviceInterest}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Khung giờ tiện liên hệ:</span>
                  <span className="font-medium text-slate-700">{preferredContactTime}</span>
                </div>
              </div>

              {/* Thông tin hỗ trợ gấp */}
              {companyData.selectedBranch?.phone && (
                <div className="pt-2">
                  <p className="text-xs text-slate-500 mb-2">Quý khách cần hỗ trợ ngay lập tức?</p>
                  <a
                    href={`tel:${companyData.selectedBranch.phone}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 shadow-sm transition-all"
                  >
                    <PhoneCall className="h-4 w-4" /> Gọi hotline: {companyData.selectedBranch.phone}
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={resetForm}
                  className="text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
                >
                  Gửi thêm thông tin khác
                </button>
              </div>
            </div>
          ) : (
            /* Biểu mẫu điền thông tin */
            <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
              {submitError && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-100">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên của Quý khách <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 sm:py-2.5 pl-10 pr-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại liên hệ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0912 345 678"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 sm:py-2.5 pl-10 pr-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Chi nhánh (Nếu công ty có nhiều chi nhánh và chưa chỉ định trong QR) */}
              {companyData.branches?.length > 1 && !companyData.selectedBranch && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cơ sở / Chi nhánh Quý khách muốn liên hệ
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 sm:py-2.5 pl-10 pr-8 text-base sm:text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="">-- Chọn chi nhánh gần nhất --</option>
                      {companyData.branches.map((b) => (
                        <option key={b._id || b.code} value={b._id || b.code}>
                          {b.name} {b.address ? `(${b.address})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Dịch vụ hoặc nhu cầu quan tâm */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" /> Dịch vụ Quý khách quan tâm
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {POPULAR_SERVICES.map((srv) => (
                    <button
                      type="button"
                      key={srv}
                      onClick={() => setServiceInterest(srv)}
                      className={`rounded-xl px-3 py-2.5 sm:py-2 text-left font-medium transition-all border text-xs sm:text-[13px] ${
                        serviceInterest === srv
                          ? "border-teal-500 bg-teal-50 text-teal-900 shadow-sm"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {srv}
                    </button>
                  ))}
                </div>

                {serviceInterest === "Nhu cầu khác" && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customService}
                      onChange={(e) => setCustomService(e.target.value)}
                      placeholder="Mô tả cụ thể dịch vụ hoặc nhu cầu của bạn..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-base sm:text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                )}
              </div>

              {/* Khung giờ liên hệ thuận tiện */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" /> Khung giờ tiện liên hệ
                </label>
                <select
                  value={preferredContactTime}
                  onChange={(e) => setPreferredContactTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 sm:py-2.5 px-3 text-base sm:text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email & Địa chỉ (Tùy chọn gom vào hàng hoặc toggle) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Email (Không bắt buộc)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Địa chỉ / Quận Huyện (Tùy chọn)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ví dụ: Quận 1, TP.HCM"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Lời nhắn / Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung lời nhắn hoặc câu hỏi cần giải đáp (nếu có)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nhập câu hỏi hoặc yêu cầu đặc biệt của Quý khách..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Nút gửi */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3.5 px-4 text-sm font-bold text-white shadow-lg shadow-teal-600/25 hover:from-teal-700 hover:to-emerald-700 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Đang gửi thông tin...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Gửi thông tin tư vấn
                    </>
                  )}
                </button>
              </div>

              {/* Cam kết bảo mật */}
              <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                <span>Thông tin của Quý khách được bảo mật tuyệt đối theo chính sách quyền riêng tư.</span>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400 space-y-1">
          <p>© {new Date().getFullYear()} {companyData.companyName || BRAND_NAME}. Nền tảng quản trị y tế Lux Care.</p>
        </footer>
      </div>
    </div>
  );
}
