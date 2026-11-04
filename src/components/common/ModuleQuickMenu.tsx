import { useEffect, useRef, useState } from "react";
import { LockKeyhole, Search, X } from "lucide-react";
import { tabToPath } from "../../seo/seo-config";
import { getAvailableMenuItems, type MenuItem } from "../../pages/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { ModuleArtwork } from "./ModuleArtwork";
import type { TabType } from "../../types";

const groups: Array<{ key: MenuItem["group"]; title: string }> = [
  { key: "main", title: "Tổng quan" },
  { key: "operations", title: "Vận hành" },
  { key: "marketing", title: "Marketing" },
  { key: "subscription", title: "Gói dịch vụ" },
  { key: "tools", title: "Công cụ" },
  { key: "system", title: "Hệ thống" },
];

export function ModuleQuickMenu({ onClose, currentTab }: { onClose: () => void; currentTab: TabType }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const { userProfile, hasPermission } = useAuth();
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const items = getAvailableMenuItems(userProfile, hasPermission, true).filter((item) =>
    item.title.toLocaleLowerCase("vi").includes(normalizedQuery),
  );
  const recentItem = items.find((item) => item.label === currentTab && !item.locked);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Danh sách phân hệ và tính năng"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-full max-w-3xl overflow-hidden border-r border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-2 sm:px-6">
          <button type="button" onClick={onClose} aria-label="Đóng danh sách phân hệ" className="flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" data-erp-modal-close>
            <X className="size-5" aria-hidden="true" />
          </button>
          <label htmlFor="module-quick-search" className="sr-only">Tìm phân hệ hoặc tính năng</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
            <input id="module-quick-search" autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm phân hệ hoặc tính năng..." className="h-10 w-full rounded-full border border-outline-variant bg-surface pl-10 pr-4 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!normalizedQuery && recentItem && (
            <section aria-labelledby="module-quick-recent" className="mb-5">
              <h2 id="module-quick-recent" className="mb-2 text-balance text-base font-semibold">Gần đây</h2>
              <a href={tabToPath(recentItem.label)} className="inline-flex min-h-20 min-w-24 flex-col items-center justify-center gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-center text-sm font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <ModuleArtwork module={recentItem.label} className="size-9" />
                <span className="max-w-36 text-pretty">{recentItem.title}</span>
              </a>
            </section>
          )}
          {items.length ? groups.map((group) => {
            const groupItems = items.filter((item) => item.group === group.key);
            if (!groupItems.length) return null;
            return (
              <section key={group.key} aria-labelledby={`module-quick-group-${group.key}`} className="mb-5 last:mb-0">
                <h2 id={`module-quick-group-${group.key}`} className="mb-2 text-balance text-base font-semibold text-on-surface">{group.title}</h2>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {groupItems.map((item) => (
                    <li key={item.label}>
                      {item.locked ? (
                        <div className="flex min-h-12 items-center gap-2 rounded-xl px-1 py-1 text-on-surface-variant" title={item.lockReason === "module" ? "Phân hệ chưa được kích hoạt" : "Bạn chưa có quyền truy cập"}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface p-1 grayscale"><ModuleArtwork module={item.label} className="size-full" /></span>
                          <span className="min-w-0 flex-1 text-pretty text-sm leading-snug">{item.title}<span className="block text-xs">{item.lockReason === "module" ? "Phân hệ chưa kích hoạt" : "Chưa có quyền truy cập"}</span></span>
                          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
                        </div>
                      ) : (
                        <a href={tabToPath(item.label)} className="flex min-h-12 items-center gap-2 rounded-xl px-1 py-1 text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface p-1"><ModuleArtwork module={item.label} className="size-full" /></span>
                          <span className="min-w-0 text-pretty text-sm font-medium leading-snug">{item.title}</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          }) : <p role="status" className="py-8 text-center text-pretty text-sm text-on-surface-variant">Không tìm thấy phân hệ phù hợp.</p>}
        </div>
      </div>
    </dialog>
  );
}
