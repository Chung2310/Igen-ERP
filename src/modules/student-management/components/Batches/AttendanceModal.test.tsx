// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import type { Batch, Student } from '../../types';
import { AttendanceModal } from './AttendanceModal';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../hooks/useEntityLabel', () => ({
  useEntityLabel: () => ({ preset: 'student', singular: 'học viên', titleCase: 'Học viên' }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('shows remaining sessions when the enrollment API omits its virtual field', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    success: true,
    data: [{ batchId: 'batch-1', studentId: 'student-1', allowedSessions: 11, attendedSessions: 0, status: 'Đang học' }],
  });
  const batch = {
    id: 'batch-1', code: 'LH-TEST-L2', courseTitle: 'Lớp kiểm thử', learnerIds: ['student-1'],
    startDate: '2026-11-10', endDate: '2026-11-10', daysOfWeek: [2], attendanceSessions: [],
  } as Batch;
  const students = [{ id: 'student-1', fullName: 'Học viên A' }] as Student[];

  render(<AttendanceModal isOpen batch={batch} students={students} onClose={vi.fn()} onSuccess={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Điểm danh' }));

  expect(await screen.findByText('Còn 11/11 buổi')).toBeTruthy();
  expect(screen.queryByText(/undefined\/11 buổi/)).toBeNull();
});
