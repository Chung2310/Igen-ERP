import React from "react";
import {
  Keyboard,
  Lock,
  Maximize,
  Minimize,
  RefreshCw,
  ScanBarcode,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "../../../../pages/Toast";

export interface PosHeaderProps {
  searchRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onScanClick: () => void;
  userProfile?: { displayName?: string; email?: string; [key: string]: any };
  branchDisplayName?: string;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenShortcuts: () => void;
  onRefreshCatalog: () => void;
  reloading: boolean;
  onCloseShift?: () => void;
  onLogout?: () => void;
  canLeavePos?: boolean;
  onLeavePos?: () => void;
}

export function PosHeader({
  searchRef,
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  onScanClick,
  userProfile,
  branchDisplayName,
  fullscreen,
  onToggleFullscreen,
  onOpenShortcuts,
  onRefreshCatalog,
  reloading,
  onCloseShift,
  onLogout,
  canLeavePos,
  onLeavePos,
}: PosHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[#dce9ff] bg-gradient-to-r from-white via-[#fbfcff] to-[#f7f3ff] px-3.5 py-2 sm:px-5 shadow-2xs">
      {/* Left: session actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onCloseShift) onCloseShift();
            else if (canLeavePos && onLeavePos) onLeavePos();
            else toast.info("Quản lý phiên POS tại menu Ca POS.");
          }}
          className="inline-flex h-9 w-28 items-center justify-center gap-1.5 rounded-xl bg-[#0866f5] px-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0758d5] active:scale-95 cursor-pointer"
          title="Đóng phiên làm việc POS"
        >
          <Lock className="h-4 w-4" />
          <span>Đóng phiên</span>
        </button>
        {onLogout && <button type="button" onClick={onLogout} className="inline-flex h-9 w-28 items-center justify-center rounded-xl bg-rose-600 px-2 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700">Đăng xuất</button>}
        {canLeavePos && onLeavePos && <button type="button" onClick={onLeavePos} className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Quay về màn quản lý">Màn quản lý</button>}
      </div>
      {/* Center: Search & Barcode Scan */}
      <div className="relative mx-3 flex-1 max-w-2xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          autoFocus
          aria-label="Tìm hoặc quét sản phẩm"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-white py-2 pl-10 pr-20 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-inner focus:border-[#0866f5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20"
          placeholder="Tìm tên, SKU, IMEI"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="rounded-full p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onScanClick}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title="Quét camera / mã vạch"
          >
            <ScanBarcode className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right: Cashier Identity & Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700">
          <User className="h-4 w-4 text-slate-400" />
          <span className="truncate max-w-[100px] sm:max-w-[140px]">
            {userProfile?.displayName || userProfile?.email || "Thu ngân"}
          </span>
          {branchDisplayName && (
            <span className="hidden md:inline rounded-full bg-[#edf3ff] px-2 py-0.5 text-[10px] font-bold text-[#0758d5] border border-[#c2d7ff]">
              {branchDisplayName}
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          aria-pressed={fullscreen}
          title={fullscreen ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình bán hàng"}
          onClick={() => void onToggleFullscreen()}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          {fullscreen ? <Minimize className="h-4 w-4 text-[#0866f5]" /> : <Maximize className="h-4 w-4 text-[#0866f5]" />}
          <span className="hidden md:inline">{fullscreen ? "Thu nhỏ" : "Toàn màn hình"}</span>
        </button>

        <button
          type="button"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          onClick={onOpenShortcuts}
          title="Xem danh sách phím tắt POS (F1)"
        >
          <Keyboard className="h-4 w-4 text-slate-400" />
          <span className="hidden md:inline">Phím tắt</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          onClick={() => void onRefreshCatalog()}
          disabled={reloading}
          title="Làm mới danh sách sản phẩm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${reloading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </header>
  );
}

export default PosHeader;
