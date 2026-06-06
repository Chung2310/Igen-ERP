import React from "react";
import { CheckCircle, X } from "lucide-react";
import Confetti from "./Confetti";

interface RegistrationSuccessModalProps {
  onClose: () => void;
}

export default function RegistrationSuccessModal({ onClose }: RegistrationSuccessModalProps) {
  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 px-8 py-10 text-center shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-white/10 bg-slate-900/80 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle className="h-11 w-11" />
          </div>
          <h3 className="text-2xl font-bold text-white">Đăng ký thành công!</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Chào mừng bạn đến với iGen ERP. Hệ thống đang chuyển bạn vào nền tảng quản trị doanh nghiệp.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </>
  );
}
