// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getModuleSettings } from './api/moduleSettings.api';
import { apiFetch } from './lib/api';
import { resetEntityPresetStoreForTests } from './hooks/entityPresetStore';
import StudentManagementTab from './StudentManagementTab';
import { clearStudentListCache } from './hooks/studentListCache';

const loads = vi.hoisted(() => ({ add: 0, detail: 0 }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userProfile: { uid: 'u1', companyCode: 'ACME', role: 'admin', permissions: ['*'] } }) }));
vi.mock('../../context/BranchContext', () => ({ useBranch: () => ({ activeBranchId: 'b1', branches: [], loading: false }) }));
vi.mock('../../hooks/useSubTabRouter', () => ({ useSubTabRouter: () => ['HỌC VIÊN', vi.fn()] }));
vi.mock('../../services/socketService', () => ({ socketService: { on: vi.fn(() => () => undefined) } }));
vi.mock('../../pages/Toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('./api/moduleSettings.api', () => ({ getModuleSettings: vi.fn() }));
vi.mock('./lib/api', () => ({ apiFetch: vi.fn(), setBusinessApiScope: vi.fn(), getBusinessApiScope: () => 'student' }));
vi.mock('./hooks/useAdminCenters', () => ({ useAdminCenters: () => ({ centers: [] }) }));
vi.mock('./hooks/useBatches', () => ({ useBatches: () => ({ batches: [] }) }));
vi.mock('./hooks/useCourses', () => ({ useCourses: () => ({ courses: [] }) }));
vi.mock('./hooks/useCourseCategories', () => ({ useCourseCategories: () => ({ categories: [] }) }));
vi.mock('./components/Student/AddStudentModal', () => { loads.add++; return { AddStudentModal: () => <div>Form thêm</div> }; });
vi.mock('./components/Student/StudentDetailModal', () => { loads.detail++; return { StudentDetailModal: () => <div>Hồ sơ chi tiết</div> }; });

beforeEach(() => {
  vi.resetAllMocks();
  clearStudentListCache();
  resetEntityPresetStoreForTests();
  vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: 'ACME', entityPreset: 'student' });
  vi.mocked(apiFetch).mockResolvedValue({ success: true, students: [] });
});
afterEach(() => { cleanup(); resetEntityPresetStoreForTests(); });

describe('student screen loading recovery', () => {
  it('loads the list once and leaves unopened add/detail modules unloaded', async () => {
    render(<StudentManagementTab />);
    await screen.findByRole('heading', { name: 'Học viên' }, { timeout: 3000 });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(loads.add).toBe(0);
    expect(loads.detail).toBe(0);
    expect(screen.queryByText('Form thêm')).toBeNull();
  });

  it('allows retrying failed settings without refreshing the browser', async () => {
    vi.mocked(getModuleSettings).mockRejectedValueOnce(new Error('Offline'));
    render(<StudentManagementTab />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('heading', { name: 'Học viên' });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(getModuleSettings).toHaveBeenCalledTimes(2);
  });

  it('shows list errors and retries them from the page', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Không kết nối được máy chủ.'));
    render(<StudentManagementTab />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không kết nối được máy chủ.');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('reuses the recent same-scope list for the add form without a duplicate download', async () => {
    render(<StudentManagementTab />);
    await screen.findByRole('heading', { name: 'Học viên' });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    expect(await screen.findByText('Form thêm')).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(loads.add).toBe(1);
  });
});
