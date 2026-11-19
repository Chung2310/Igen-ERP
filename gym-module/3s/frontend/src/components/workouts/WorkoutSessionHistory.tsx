import { useCallback, useEffect, useState } from 'react';
import DataList, { type DataColumn } from '../ui/DataList';
import Pagination from '../ui/Pagination';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

interface WorkoutSession { [key: string]: unknown; _id: string; performedAt: string; attendance: string; feeling?: string; notes?: string }
interface Props { customerId: string; refreshKey: number }
export default function WorkoutSessionHistory({ customerId, refreshKey }: Props) {
  const toast = useToast(); const [items, setItems] = useState<WorkoutSession[]>([]); const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });
  const load = useCallback(async (page = 1) => { if (!customerId) { setItems([]); return; } try { const result = await api.get<WorkoutSession[]>(`/api/workout-sessions?customerId=${encodeURIComponent(customerId)}&page=${page}&limit=20`); setItems(result.data); if (result.meta) setMeta(result.meta); } catch (error) { toast.error(errorMessage(error)); } }, [customerId, toast]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const columns: DataColumn<WorkoutSession>[] = [{ key: 'performedAt', label: 'Ngày tập', render: (item) => new Date(item.performedAt).toLocaleDateString('vi-VN') }, { key: 'attendance', label: 'Điểm danh' }, { key: 'feeling', label: 'Cảm nhận' }, { key: 'notes', label: 'Ghi chú' }];
  return <section className="panel"><h2>Lịch sử buổi tập</h2>{customerId ? <><DataList items={items} columns={columns} emptyMessage="Chưa có buổi tập nào." /><Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} /></> : <div className="empty-state">Nhập mã khách hàng để xem lịch sử.</div>}</section>;
}
