import React, { useState, useEffect } from "react";
import { ShieldAlert, Search, Trash2, CheckCircle2, Clock, Mail, AlertCircle, ArrowLeft } from "lucide-react";
import { SEOHead } from "../seo/SEOHead";
import { BRAND_NAME } from "../config/brand";

interface DeletionStatus {
  code: string;
  facebookUserId: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  details?: string;
}

export default function UserDataDeletion() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<DeletionStatus | null>(null);

  const meta = {
    title: "Yêu cầu xóa dữ liệu người dùng | iGen ERP",
    description: "Hướng dẫn xóa dữ liệu người dùng và tra cứu trạng thái yêu cầu xóa dữ liệu trên hệ thống iGen ERP.",
    keywords: "xóa dữ liệu, user data deletion, bảo mật thông tin, igen erp",
    path: "/user-data-deletion",
  };

  // Tự động kiểm tra nếu có mã code trên URL query (?code=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code") || params.get("id");
    if (codeParam) {
      setCode(codeParam);
      handleCheckStatus(codeParam);
    }
  }, []);

  const handleCheckStatus = async (checkCode: string) => {
    const activeCode = checkCode || code;
    if (!activeCode.trim()) {
      setError("Vui lòng nhập mã xác nhận.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusResult(null);

    try {
      const response = await fetch(`/api/v1/facebook/data-deletion-status/${activeCode.trim()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Không tìm thấy mã yêu cầu xóa dữ liệu.");
      }

      setStatusResult(result.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kiểm tra mã xác nhận.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-left">
      <SEOHead meta={meta} />

      {/* Hero Header Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/50 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
        <div className="space-y-3 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            <span>Quyền riêng tư & Kiểm soát</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            User Data Deletion
          </h1>
          <p className="text-slate-400 text-xs font-medium">Hướng dẫn xóa dữ liệu người dùng và tra cứu trạng thái yêu cầu</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs z-10 shrink-0">
          <div className="border border-slate-700/50 rounded-2xl p-4 bg-slate-800/40 backdrop-blur-sm">
            <strong className="block text-[10px] uppercase text-slate-500 tracking-wider mb-1">Dịch vụ</strong>
            <span className="font-semibold text-slate-200">{BRAND_NAME}</span>
          </div>
          <div className="border border-slate-700/50 rounded-2xl p-4 bg-slate-800/40 backdrop-blur-sm">
            <strong className="block text-[10px] uppercase text-slate-500 tracking-wider mb-1">Quy định</strong>
            <span className="font-semibold text-slate-200">GDPR / Meta Compliance</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: Check Status Box */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              Tra cứu trạng thái
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed">
              Nếu bạn đã gửi yêu cầu xóa dữ liệu qua Facebook hoặc nhận được mã xác nhận định dạng <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-[10px]">DEL-XXXXXXXX</code>, hãy nhập mã vào đây để kiểm tra tiến trình.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Ví dụ: DEL-3E5A29CD"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckStatus("")}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
              />
              <button
                onClick={() => handleCheckStatus("")}
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer duration-200"
              >
                {loading ? "Đang truy vấn..." : "Kiểm tra trạng thái"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200/50 text-red-600 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                <span className="font-medium text-left leading-normal">{error}</span>
              </div>
            )}

            {/* Status Results Display */}
            {statusResult && (
              <div className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-4 space-y-3 text-xs animate-fade-in-up">
                <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                  <span className="font-bold text-slate-700 font-mono">{statusResult.code}</span>
                  {statusResult.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                      <CheckCircle2 className="h-3 w-3" />
                      Đã hoàn thành
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                      <Clock className="h-3 w-3 animate-spin" />
                      Đang xử lý
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <p className="flex justify-between">
                    <span>Facebook User:</span>
                    <span className="font-mono text-slate-800">{statusResult.facebookUserId.slice(0, 6)}***</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Thời gian nhận:</span>
                    <span className="text-slate-800">{new Date(statusResult.requestedAt).toLocaleString("vi-VN")}</span>
                  </p>
                  {statusResult.completedAt && (
                    <p className="flex justify-between">
                      <span>Hoàn tất lúc:</span>
                      <span className="text-slate-800">{new Date(statusResult.completedAt).toLocaleString("vi-VN")}</span>
                    </p>
                  )}
                  {statusResult.details && (
                    <div className="border-t border-indigo-100/30 pt-2 mt-2">
                      <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Chi tiết xử lý</p>
                      <p className="text-slate-650 bg-slate-100/50 p-2 rounded-lg font-mono text-[10px] leading-relaxed break-words">{statusResult.details}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Instructions */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              1. Phương thức xóa liên kết tự động (Facebook)
            </h2>
            <p className="leading-relaxed text-slate-600 text-xs">
              Nếu bạn đã đăng nhập hoặc liên kết các Fanpage/Messenger của mình vào hệ thống **{BRAND_NAME}** thông qua đăng nhập Facebook, bạn có thể chủ động hủy kết nối và yêu cầu xóa toàn bộ thông tin đã lưu trữ theo các bước sau:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-xs">
              <li>Truy cập vào tài khoản Facebook cá nhân của bạn.</li>
              <li>Đi tới phần <strong className="text-slate-800">Cài đặt & Quyền riêng tư</strong> &gt; <strong className="text-slate-800">Cài đặt</strong> &gt; <strong className="text-slate-800">Ứng dụng và trang web</strong> (hoặc nhấn trực tiếp vào liên kết cài đặt ứng dụng của Facebook).</li>
              <li>Tìm kiếm ứng dụng tên <strong className="text-indigo-600">TestLogin</strong> hoặc ứng dụng tích hợp ERP liên quan.</li>
              <li>Bấm nút <strong className="text-red-600">Gỡ (Remove)</strong> bên cạnh ứng dụng.</li>
              <li>Facebook sẽ tự động gửi một thông báo Webhook giải phóng dữ liệu tới hệ thống của chúng tôi. Chúng tôi sẽ lập tức ngắt liên kết, hủy trạng thái kết nối Token của các Fanpage và gửi lại cho bạn một mã xác nhận để theo dõi trực tuyến.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Mail className="h-5 w-5 text-indigo-600" />
              2. Phương thức xóa thủ công & Hỗ trợ kỹ thuật
            </h2>
            <p className="leading-relaxed text-slate-600 text-xs">
              Trong trường hợp bạn muốn xóa toàn bộ tài khoản doanh nghiệp, tài khoản cá nhân, hoặc dữ liệu lưu giữ trên nền tảng ERP của chúng tôi, bạn có thể thực hiện một trong hai cách:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 text-xs">
              <li>
                <strong className="text-slate-800">Yêu cầu từ trang Quản trị:</strong> Đăng nhập hệ thống, truy cập <strong className="text-slate-800">Cài đặt hệ thống</strong> &gt; <strong className="text-slate-800">Liên kết MXH</strong> và bấm nút <strong className="text-red-500">Xóa liên kết</strong>.
              </li>
              <li>
                <strong className="text-slate-800">Gửi yêu cầu qua Email hỗ trợ:</strong> Gửi thư yêu cầu đến hòm thư hỗ trợ của chúng tôi tại địa chỉ <a href="mailto:tiennt231@gmail.com" className="text-indigo-600 font-bold hover:underline">tiennt231@gmail.com</a> kèm theo thông tin tài khoản (Email, số điện thoại đăng ký, hoặc mã Fanpage cần xóa).
              </li>
            </ul>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              * Chúng tôi cam kết xử lý tất cả các yêu cầu xóa dữ liệu thủ công trong vòng tối đa 24 giờ làm việc kể từ thời điểm nhận được yêu cầu. Dữ liệu sau khi xóa sẽ biến mất vĩnh viễn khỏi các phân vùng lưu trữ và không thể phục hồi.
            </p>
          </section>

          <section className="pt-2 border-t border-slate-100 space-y-2">
            <h3 className="text-xs font-bold text-slate-800">Dữ liệu nào sẽ bị xóa sạch?</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Khi thực hiện xóa dữ liệu liên kết, hệ thống sẽ thực hiện xóa bỏ vĩnh viễn:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">Tokens & Khóa liên kết</span>
                <span className="text-slate-500">Mọi Access Token, Refresh Token dùng để tương tác qua Graph API sẽ bị thu hồi hoàn toàn.</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">Nhật ký tin nhắn & Chat</span>
                <span className="text-slate-500">Dữ liệu hội thoại tạm thời lưu trên Omni-Inbox của doanh nghiệp liên quan đến tài khoản kết nối đó.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
