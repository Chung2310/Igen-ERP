/* eslint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, type LucideIcon } from 'lucide-react';
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: string; type: ToastType; message: string }
interface ToastApi { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void }
const ToastContext = createContext<ToastApi | null>(null);
const icons: Record<ToastType, LucideIcon> = { success: CheckCircle2, error: AlertCircle, info: Info };
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback((type: ToastType, message: string) => { const id = `${Date.now()}-${Math.random()}`; setItems((current) => [...current, { id, type, message }]); window.setTimeout(() => remove(id), 4000); }, [remove]);
  const value = useMemo<ToastApi>(() => ({ success: (message) => show('success', message), error: (message) => show('error', message), info: (message) => show('info', message) }), [show]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack z-[10000]" aria-live="polite">{items.map((item) => { const Icon = icons[item.type]; return <div className={`toast toast-${item.type}`} key={item.id}><Icon size={20} /><span>{item.message}</span><button type="button" aria-label="Đóng thông báo" onClick={() => remove(item.id)}><X size={16} /></button></div>; })}</div></ToastContext.Provider>;
}
const noopToast: ToastApi = { success: () => {}, error: () => {}, info: () => {} };
export function useToast(): ToastApi { const context = useContext(ToastContext); return context || noopToast; }
