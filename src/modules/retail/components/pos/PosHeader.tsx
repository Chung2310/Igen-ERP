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
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface sm:px-5">
      {/* Left: session actions */}
      <div className="order-1 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (onCloseShift) onCloseShift();
            else if (canLeavePos && onLeavePos) onLeavePos();
            else toast.info("Quản lý phiên POS tại menu Ca POS.");
          }}
          className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          title="Đóng phiên làm việc POS"
        >
          <Lock className="h-4 w-4" />
          <span>Đóng phiên</span>
        </button>
        {onLogout && <button type="button" onClick={onLogout} className="inline-flex min-h-9 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-primary">Đăng xuất</button>}
        {canLeavePos && onLeavePos && <button type="button" onClick={onLeavePos} className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary" title="Quay về màn quản lý">Màn quản lý</button>}
      </div>
      {/* Center: Search & Barcode Scan */}
      <div className="relative order-3 w-full lg:order-2 lg:mx-2 lg:min-w-48 lg:max-w-2xl lg:flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchRef}
          autoFocus
          aria-label="Tìm hoặc quét sản phẩm"
          className="min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-20 text-xs text-on-surface placeholder:text-on-surface-variant hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:text-sm"
          placeholder="Tìm tên, SKU, IMEI"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {searchQuery && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => onSearchChange("")}
              className="rounded-full p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Quét camera hoặc mã vạch"
            onClick={onScanClick}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title="Quét camera / mã vạch"
          >
            <ScanBarcode className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right: Cashier Identity & Actions */}
      <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
        <div className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-xs font-medium text-on-surface sm:px-3 sm:text-sm">
          <User className="h-4 w-4 text-slate-400" />
          <span className="truncate max-w-[100px] sm:max-w-[140px]">
            {userProfile?.displayName || userProfile?.email || "Thu ngân"}
          </span>
          {branchDisplayName && (
            <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary md:inline">
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
          className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest p-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary sm:inline-flex"
        >
          {fullscreen ? <Minimize className="size-4 text-primary" /> : <Maximize className="size-4 text-primary" />}
          <span className="hidden md:inline">{fullscreen ? "Thu nhỏ" : "Toàn màn hình"}</span>
        </button>

        <button
          type="button"
          className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest p-2 text-xs font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary sm:inline-flex"
          onClick={onOpenShortcuts}
          title="Xem danh sách phím tắt POS (F1)"
        >
          <Keyboard className="h-4 w-4 text-slate-400" />
          <span className="hidden md:inline">Phím tắt</span>
        </button>

        <button
          type="button"
          aria-label="Làm mới danh sách sản phẩm"
          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest p-2 text-on-surface hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
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
