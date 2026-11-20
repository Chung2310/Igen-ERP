import { getSession } from './session';

export interface ErpTransaction {
  _id: string;
  orderCode: number;
  amount: number;
  type: 'deposit' | 'payment' | 'withdraw';
  status: 'pending' | 'success' | 'failed';
  description?: string;
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSession()?.token;
  const response = await fetch(`/api/v1/wallet${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(result.message || 'Không thể truy cập ví Credit ERP.');
  return result;
}

export const erpWallet = {
  balance: async () => (await request<{ balance: number }>('/balance')).balance,
  transactions: async () => (await request<{ data: ErpTransaction[] }>('/transactions')).data,
  deposit: async (amount: number) => (await request<{ data: { checkoutUrl: string; orderCode: number; isMock: boolean } }>('/deposit', {
    method: 'POST', body: JSON.stringify({ amount, context: 'gym' }),
  })).data,
  confirmMock: async (orderCode: number) => request('/webhook-mock', { method: 'POST', body: JSON.stringify({ orderCode }) }),
  check: async (orderCode: number) => request(`/check/${orderCode}`),
};
