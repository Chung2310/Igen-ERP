import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';
import { notificationDestination, type NotificationItem } from './notificationModel';

export default function NotificationBell() {
  const toast = useToast();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await api.get<NotificationItem[]>('/api/notifications?page=1&limit=10');
      setItems(result.data);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const openNotification = async (item: NotificationItem) => {
    try {
      if (!item.readAt) {
        await api.patch(`/api/notifications/${item._id}/read`, {});
        setItems((current) => current.map((value) => value._id === item._id ? { ...value, readAt: new Date().toISOString() } : value));
      }
      setIsOpen(false);
      const destination = notificationDestination(item.resourceType);
      if (destination) navigate(destination);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const unread = items.filter((item) => !item.readAt).length;
  const unreadLabel = unread ? `${unread} thông báo chưa đọc` : 'Không có thông báo chưa đọc';

  return <span className="relative inline-flex" ref={containerRef}>
    <button ref={buttonRef} type="button" aria-label={unreadLabel} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="relative inline-grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-primary shadow-sm transition hover:border-sky-300 hover:bg-sky-50 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none">
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px]! font-bold! leading-none! text-white! ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
    </button>

    {isOpen && <section role="dialog" aria-label="Thông báo gần đây" className="absolute right-0 top-12 z-50 flex max-h-[min(32rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><strong className="block text-sm! font-bold! text-primary!">Thông báo</strong><span className="text-xs! text-slate-500!">{unread} chưa đọc</span></div>
      </header>
      <div className="min-h-24 overflow-y-auto">
        {loading && <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} aria-hidden="true" />Đang tải thông báo...</div>}
        {!loading && loadError && <div className="grid justify-items-center gap-3 px-5 py-7 text-center"><p className="m-0 text-sm text-slate-600">Không thể tải thông báo.</p><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none"><RefreshCw size={15} aria-hidden="true" />Thử lại</button></div>}
        {!loading && !loadError && !items.length && <p className="m-0 px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo.</p>}
        {!loading && !loadError && items.map((item) => <button key={item._id} type="button" onClick={() => void openNotification(item)} className={`grid w-full grid-cols-[8px_minmax(0,1fr)] gap-3 border-0 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-secondary motion-reduce:transition-none ${item.readAt ? 'bg-white' : 'bg-sky-50/70'}`}>
          <span aria-hidden="true" className={`mt-1.5 size-2 rounded-full ${item.readAt ? 'bg-slate-300' : 'bg-secondary'}`} />
          <span className="grid min-w-0 gap-1"><strong className="truncate text-sm! font-semibold! text-slate-900!">{item.title}</strong><span className="line-clamp-2 text-xs! leading-5! text-slate-600!">{item.message}</span></span>
        </button>)}
      </div>
      <Link to="/notifications" onClick={() => setIsOpen(false)} className="border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-primary transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-secondary motion-reduce:transition-none">Xem tất cả thông báo</Link>
    </section>}
  </span>;
}
