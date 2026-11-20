import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import {
  X,
  QrCode,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  Building2,
  Tag,
  Sparkles,
  Info,
} from "lucide-react";
import { BRAND_NAME } from "../../config/brand";

interface BranchItem {
  _id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
}

interface CustomerQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
  companyName: string;
  branches: BranchItem[];
  userBranchId?: string;
}

export default function CustomerQrModal({
  isOpen,
  onClose,
  companyCode,
  companyName,
  branches,
  userBranchId,
}: CustomerQrModalProps) {
  const [selectedBranchCode, setSelectedBranchCode] = useState<string>("");
  const [campaign, setCampaign] = useState("Quầy tiếp tân");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Khởi tạo chi nhánh theo người dùng nếu có
  useEffect(() => {
    if (userBranchId && branches.length > 0) {
      const userBranch = branches.find((b) => b._id === userBranchId);
      if (userBranch) {
        setSelectedBranchCode(userBranch.code);
      }
    }
  }, [userBranchId, branches]);

  // Sinh URL công khai
  const generateTargetUrl = () => {
    const origin = window.location.origin;
    const url = new URL("/tiep-nhan-khach-hang", origin);
    url.searchParams.set("c", companyCode || "COMPANY");
    if (selectedBranchCode) {
      url.searchParams.set("b", selectedBranchCode);
    }
    if (campaign.trim()) {
      url.searchParams.set("camp", campaign.trim());
    }
    url.searchParams.set("src", "qr");
    return url.toString();
  };

  const targetUrl = generateTargetUrl();

  // Sinh mã QR khi URL thay đổi
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setGenerating(true);

    QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#0d5f57", // Teal sang trọng của Lux Care
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi sinh mã QR:", err);
        if (isMounted) setGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = targetUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    const filename = `QR_Thu_thap_khach_hang_${companyCode}_${selectedBranchCode || "ALL"}.png`;
    link.href = qrDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Vui lòng cho phép mở cửa sổ popup để in thẻ QR.");
      return;
    }

    const selectedBranch = branches.find((b) => b.code === selectedBranchCode);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Standee QR - ${companyName}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              color: #1e293b;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              background-color: #ffffff;
            }
            .standee-card {
              width: 100%;
              max-width: 380px;
              border: 2px solid #0d5f57;
              border-radius: 24px;
              padding: 32px 24px;
              text-align: center;
              box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            }
            .logo-text {
              font-size: 22px;
              font-weight: 800;
              color: #0d5f57;
              letter-spacing: -0.5px;
              margin-bottom: 4px;
            }
            .sub-title {
              font-size: 13px;
              color: #64748b;
              margin-bottom: 24px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .qr-wrapper {
              background: #ffffff;
              padding: 16px;
              border-radius: 20px;
              display: inline-block;
              border: 1px solid #e2e8f0;
              margin-bottom: 20px;
            }
            .qr-image {
              width: 220px;
              height: 220px;
              display: block;
            }
            .call-to-action {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 6px;
            }
            .scan-hint {
              font-size: 13px;
              color: #475569;
              margin-bottom: 20px;
            }
            .branch-info {
              font-size: 12px;
              color: #0d5f57;
              font-weight: 600;
              background: #f0fdfa;
              padding: 8px 16px;
              border-radius: 12px;
              display: inline-block;
            }
            .footer {
              margin-top: 20px;
              font-size: 11px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="logo-text">${companyName || BRAND_NAME}</div>
            <div class="sub-title">Hệ thống Y tế & Chăm sóc Khách hàng</div>
            
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" class="qr-image" alt="QR Code" />
            </div>

            <div class="call-to-action">QUÉT MÃ ĐỂ ĐĂNG KÝ TƯ VẤN</div>
            <div class="scan-hint">Dùng camera điện thoại hoặc Zalo để quét mã và điền thông tin nhanh chóng</div>

            ${
              selectedBranch
                ? `<div class="branch-info">Cơ sở: ${selectedBranch.name}${selectedBranch.phone ? ` • Hotline: ${selectedBranch.phone}` : ""}</div>`
                : `<div class="branch-info">Vị trí: ${campaign}</div>`
            }

            <div class="footer">Lux Care • Tiếp nhận và hỗ trợ khách hàng chu đáo 24/7</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-500/20">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mã QR Tiếp nhận Khách hàng</h2>
              <p className="text-xs text-slate-500">
                Tạo mã QR liên kết biểu mẫu điền thông tin khách hàng công khai
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Cột trái: Cấu hình mã QR */}
          <div className="md:col-span-6 space-y-4">
            {/* Chọn chi nhánh */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-teal-600" /> Áp dụng cho chi nhánh
              </label>
              <select
                value={selectedBranchCode}
                onChange={(e) => setSelectedBranchCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">-- Toàn hệ thống (Khách tự chọn chi nhánh) --</option>
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Gắn mã chi nhánh giúp khách hàng quét tại cơ sở nào được gán trực tiếp cho cơ sở đó.
              </p>
            </div>

            {/* Vị trí đặt / Tên chiến dịch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-teal-600" /> Vị trí đặt / Tên nguồn
              </label>
              <input
                type="text"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="Ví dụ: Quầy tiếp tân, Bàn tư vấn 2, Tờ rơi..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["Quầy tiếp tân", "Bàn tư vấn", "Sự kiện", "Banner Fanpage"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCampaign(tag)}
                    className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Liên kết Public URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đường dẫn liên kết trực tiếp
              </label>
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <span className="truncate flex-1 font-mono text-[11px] text-teal-800">{targetUrl}</span>
                <button
                  onClick={handleCopyLink}
                  title="Sao chép liên kết"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-teal-600 shadow-sm transition-all"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Mở biểu mẫu thử nghiệm"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-teal-600 shadow-sm transition-all"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Ghi chú hướng dẫn */}
            <div className="rounded-2xl bg-teal-50/60 p-3.5 border border-teal-100 text-xs text-teal-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-teal-950">
                <Info className="h-4 w-4 text-teal-700 shrink-0" />
                <span>Hướng dẫn sử dụng:</span>
              </div>
              <p className="text-[11px] text-teal-800 leading-relaxed">
                Tải ảnh mã QR để in thành standee để bàn, thẻ tiếp đón, hoặc đăng trên tờ rơi. Khách hàng quét mã bằng Zalo hoặc Camera điện thoại để gửi thông tin trực tiếp vào hệ thống.
              </p>
            </div>
          </div>

          {/* Cột phải: Xem trước mã QR & Hành động */}
          <div className="md:col-span-6 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
            {/* Standee Preview */}
            <div
              ref={printRef}
              className="relative w-full max-w-[240px] rounded-2xl bg-white p-4 shadow-sm border border-slate-200 text-center space-y-2"
            >
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-teal-800">
                <Sparkles className="h-3 w-3 text-teal-600" />
                <span className="truncate">{companyName || BRAND_NAME}</span>
              </div>

              <div className="relative aspect-square w-full rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                {generating ? (
                  <div className="text-xs text-slate-400 animate-pulse">Đang tạo mã QR...</div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="Mã QR thu thập khách hàng" className="h-full w-full object-contain p-1" />
                ) : (
                  <QrCode className="h-16 w-16 text-slate-300" />
                )}
              </div>

              <p className="text-xs font-bold text-slate-800 leading-tight">QUÉT MÃ ĐIỀN THÔNG TIN</p>
              <p className="text-[10px] text-slate-400">
                {selectedBranchCode ? `Chi nhánh: ${selectedBranchCode}` : "Hệ thống toàn quốc"}
                {campaign ? ` • ${campaign}` : ""}
              </p>
            </div>

            {/* Các nút hành động */}
            <div className="mt-5 w-full flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadPng}
                disabled={!qrDataUrl}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-teal-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Download className="h-4 w-4" /> Tải ảnh PNG
              </button>

              <button
                onClick={handlePrint}
                disabled={!qrDataUrl}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-slate-900 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" /> In Standee
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
