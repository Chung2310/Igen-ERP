/* eslint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CreditWallet } from '../types/credits';
import { CREDIT_WALLET_MUTATED_EVENT } from '../services/api';
import { creditsService } from '../services/credits';

interface CreditWalletState { wallet: CreditWallet | null; loading: boolean; error: string; refresh: () => Promise<void> }
const fallback: CreditWalletState = { wallet: null, loading: false, error: '', refresh: async () => undefined };
const CreditWalletContext = createContext<CreditWalletState>(fallback);

export function CreditWalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<CreditWallet | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(async () => { setLoading(true); try { setWallet(await creditsService.wallet()); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải ví credit.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); return () => window.clearTimeout(timer.current); }, [refresh]);
  useEffect(() => { const listener = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void refresh(), 120); }; window.addEventListener(CREDIT_WALLET_MUTATED_EVENT, listener); return () => window.removeEventListener(CREDIT_WALLET_MUTATED_EVENT, listener); }, [refresh]);
  const value = useMemo(() => ({ wallet, loading, error, refresh }), [wallet, loading, error, refresh]);
  return <CreditWalletContext.Provider value={value}>{children}</CreditWalletContext.Provider>;
}
export const useCreditWallet = () => useContext(CreditWalletContext);
