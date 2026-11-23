// All entities are artificial replacements. No names from the user's screenshot.
import { EXTRA_CASES } from './extra-scenarios';
const write = (id, row, text, actions, extra = {}) => ({ id, row, text, actions, kind: 'write', ...extra });
const read = (id, row, text, actions, extra = {}) => ({ id, row, text, actions, kind: 'read', ...extra });
const scenarios = [
  write('L01', 2, 'tạo 1 dự án mới tên QA-LAB-NEW-20 trong mục quản lí lao động\nMình chọn Tên lao động: LAO-DONG-MAU-01 — Chi nhánh MẪU-QA, LAO-DONG-MAU-02 — Chi nhánh MẪU-QA, LAO-DONG-MAU-03 — Chi nhánh MẪU-QA, LAO-DONG-MAU-04 — Chi nhánh MẪU-QA, LAO-DONG-MAU-05 — Chi nhánh MẪU-QA; Các ngày trong tuần · Các ngày trong tuần: Thứ 2, Thứ 4, Thứ 6, Thứ 3, Thứ 5, Thứ 7.', ['worker.project.create'], { fill: { code: 'QA-PREVIEW-20' } }),
  read('L02', 3, 'Báo cáo tình hình chấm công các lao động hôm nay', ['worker.report'], { mode: 'all', today: true }),
  read('L03', 4, 'báo cáo tình hình chấm công các lao động trong dự án: QA-KHO-01', ['worker.report', 'worker.attendance.list'], { project: 'QA-KHO-01' }),
  read('L04', 5, 'Dự án QA-KHO-01 có ai đi muộn', ['worker.report'], { mode: 'late', project: 'QA-KHO-01' }),
  read('L05', 6, 'Dự án QA-KHO-01 có ai vắng', ['worker.report'], { mode: 'absent', project: 'QA-KHO-01' }),
  write('L06', 7, 'Cập nhật địa điểm cho dự án QA-BANLE-02 thành 140 Đường Kiểm Thử', ['worker.project.update'], { project: 'QA-BANLE-02', expected: { location: '140 Đường Kiểm Thử' } }),
  write('L07', 8, 'xóa nhân sự LAO-DONG-MAU-06 khỏi dự án QA-LAB-03', ['worker.project.worker.remove'], { project: 'QA-LAB-03', worker: 'LAO-DONG-MAU-06' }),
  read('L08', 9, 'những dự án nào đang thiếu lao động', ['worker.report'], { mode: 'shortage' }),
  read('L09', 10, 'Dự án QA-LAB-03 có lao động nào vắng trên 3 buổi', ['worker.report'], { mode: 'absence-threshold', project: 'QA-LAB-03', threshold: 3, fill: { from: '2026-11-01', to: '2026-11-21' }, mustAskPeriod: true }),
  write('L10', 11, 'thêm lao động LAO-DONG-MAU-08 vào quản lý lao động', ['worker.create'], { expected: { fullName: 'LAO-DONG-MAU-08' } }),
  read('L11', 12, 'trong quản lí lao động, báo cáo Danh sách các lao động chưa có hợp đồng', ['worker.list', 'worker.report', 'worker.labor.contract.list'], { unsupportedFilter: 'without-contract' }),
  read('L12', 13, 'xuất cho tôi file excel danh sách hợp đồng lao động', ['worker.labor.contract.list'], { export: true }),
  write('L13', 14, 'chuyển lao động LAO-DONG-MAU-07 sang hình thức thời vụ', ['worker.update'], { worker: 'LAO-DONG-MAU-07', expected: { laborType: 'seasonal' } }),
  write('L14', 15, 'xóa hợp đồng của lao động LAO-DONG-MAU-04', ['worker.labor.contract.delete'], { worker: 'LAO-DONG-MAU-04' }),
  write('L15', 16, 'đổi đơn vị sử dụng của LAO-DONG-MAU-05 thành CÔNG TY MẪU QA-EMPLOYER', ['worker.labor.contract.update'], { worker: 'LAO-DONG-MAU-05', expected: { clientName: 'CÔNG TY MẪU QA-EMPLOYER' } }),
  { id: 'C01', row: null, text: 'Tạo dự án mới tên QA-TYPE-CHOICE', actions: [], kind: 'clarify', control: true, expectNamespaceQuestion: true },
  write('C02', null, 'Tạo dự án mới tên QA-HR-ONLY trong phân hệ Nhân sự', ['project.create'], { control: true }),
  write('E01', null, 'Tạo học viên HOC-VIEN-MAU-01, số điện thoại 0900000001, email qa@example.test, ngày đăng ký 23/11/2026', ['student.create'], { control: true, email: 'qa@example.test', expected: { fullName: 'HOC-VIEN-MAU-01', email: 'qa@example.test' } }),
  write('E02', null, 'Tạo học viên HOC-VIEN-MAU-02, số điện thoại 0900000002, email qa@company.vn, ngày đăng ký 23/11/2026', ['student.create'], { control: true, email: 'qa@company.vn', expected: { fullName: 'HOC-VIEN-MAU-02', email: 'qa@company.vn' } }),
  ...EXTRA_CASES,
];
const selectedIds = (process.env.ASSISTANT_WORKER_LIVE_CASE_IDS || '').split(',').filter(Boolean);
if (selectedIds.some(id => !scenarios.some(item => item.id === id))) throw new Error('Unknown selected live case');
export const CASES = selectedIds.length ? scenarios.filter(item => selectedIds.includes(item.id)) : scenarios.filter(item => !item.id.startsWith('X'));
