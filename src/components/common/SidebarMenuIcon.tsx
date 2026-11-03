import type { ReactNode } from 'react';
import { HrSidebarIcon, type HrSidebarIconName } from './HrSidebarIcon';

// The HR rail is the reference: 24 px artwork, soft corners, and a 1.65 px line.
const hrIcons: Record<string, HrSidebarIconName> = {
  'Sơ đồ tổ chức': 'organization', 'Phòng ban': 'department', 'Chi nhánh': 'branch',
  'Đào tạo': 'training', 'Quy trình': 'workflow', 'Giao việc': 'tasks',
  'Lịch & Ca làm việc': 'calendar', 'Hợp đồng': 'contract', 'Bảng lương': 'payroll',
  'Email chúc mừng': 'celebration', 'Tuyển dụng': 'recruitment',
  'Doanh nghiệp': 'business', 'Tài chính': 'finance', 'Bán lẻ & POS': 'retail',
  'Nhân sự': 'people', 'Học viên & Đào tạo': 'students', 'Lao động': 'labor',
  'Marketing': 'marketing', 'Khách hàng': 'people', 'Công việc': 'tasks',
  'MXH Doanh nghiệp': 'business', 'MXH Cá nhân': 'people',
  'Ca làm việc': 'calendar', 'Lịch đăng content': 'calendar',
  'Cấp gói doanh nghiệp': 'business',
};

const artwork = {
  overview: <><rect x="3.2" y="4" width="7.3" height="7.3" rx="2"/><rect x="13.5" y="4" width="7.3" height="7.3" rx="2"/><rect x="3.2" y="14" width="7.3" height="6" rx="2"/><rect x="13.5" y="14" width="7.3" height="6" rx="2"/></>,
  list: <><rect x="3.2" y="3.5" width="17.6" height="17" rx="3"/><path d="M8 8.4h.1m3.1 0h5M8 12h.1m3.1 0h5M8 15.6h.1m3.1 0h5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m9 2.8.5 1.7 2.5.6 2.5-.6.5-1.7 2.4 1.4-.5 1.8 1.8 1.8 1.8-.5 1.4 2.4-1.7.5-.6 2.5.6 2.5 1.7.5-1.4 2.4-1.8-.5-1.8 1.8.5 1.8-2.4 1.4-.5-1.7-2.5-.6-2.5.6-.5 1.7-2.4-1.4.5-1.8-1.8-1.8-1.8.5-1.4-2.4 1.7-.5.6-2.5-.6-2.5-1.7-.5 1.4-2.4 1.8.5 1.8-1.8-.5-1.8L9 2.8Z"/></>,
  history: <><path d="M4.8 8.2A8.3 8.3 0 1 1 3.7 13M4.8 3.8v4.4h4.4"/><path d="M12 7.7v4.6l3.1 2"/></>,
  bag: <><rect x="3.3" y="7.8" width="17.4" height="13" rx="2.7"/><path d="M8.1 8V6a3.9 3.9 0 0 1 7.8 0v2M3.4 13.1h17.2"/></>,
  shield: <><path d="M12 2.8 20 6v5.5c0 4.7-3 8-8 9.7-5-1.7-8-5-8-9.7V6l8-3.2Z"/><path d="m8.7 12.1 2.2 2.2 4.6-4.7"/></>,
  coin: <><circle cx="12" cy="12" r="8.7"/><path d="M14.7 8.4h-3.3a2.2 2.2 0 0 0 0 4.4h1.2a2.2 2.2 0 0 1 0 4.4H9.2M12 6.8v10.5"/></>,
  receipt: <><path d="M5 3.3h14v17.4l-2.4-1.4-2.3 1.4-2.3-1.4-2.3 1.4-2.3-1.4L5 20.7V3.3Z"/><path d="M8 8.1h8M8 11.5h8m-8 3.4h4"/></>,
  package: <><path d="m12 2.8 8.5 4.5v9.4L12 21.2l-8.5-4.5V7.3L12 2.8Z"/><path d="m3.8 7.4 8.2 4.5 8.2-4.5M12 12v9"/></>,
  warehouse: <><path d="m2.8 9 9.2-5.6L21.2 9v11.2H2.8V9Z"/><path d="M8 20v-7h8v7M5.6 10h12.8"/></>,
  inbound: <><path d="m12 2.8 8 4.3v9.2l-8 4.4-8-4.4V7.1l8-4.3Z"/><path d="m4 7.2 8 4.2 8-4.2M12 11.5v5m-2.2-2.2L12 16.5l2.2-2.2"/></>,
  outbound: <><path d="m12 2.8 8 4.3v9.2l-8 4.4-8-4.4V7.1l8-4.3Z"/><path d="m4 7.2 8 4.2 8-4.2M12 17v-5m-2.2 2.2L12 12l2.2 2.2"/></>,
  barcode: <><rect x="2.8" y="4" width="18.4" height="16" rx="2.8"/><path d="M6 8v8m3-8v8m3-8v8m2.5-8v8M18 8v8"/></>,
  transfer: <><rect x="2.5" y="5" width="7" height="6" rx="1.7"/><rect x="14.5" y="13" width="7" height="6" rx="1.7"/><path d="M10 8h9m-2.2-2.2L19 8l-2.2 2.2M14 16H5m2.2-2.2L5 16l2.2 2.2"/></>,
  chart: <><path d="M4 20V4m0 16h16M7.8 15l3.3-4 3.1 2 4.1-6"/><circle cx="18.3" cy="7" r="1"/></>,
  forecast: <><path d="M4 19.5h16M5.5 16V12m4.5 4V7m4.5 9v-4m4.5 4V5"/><path d="m15.7 6.2 3.3-1.2 1.2 3.3"/></>,
  clock: <><circle cx="12" cy="12" r="8.7"/><path d="M12 6.9v5.4l3.4 2"/></>,
  request: <><rect x="4.2" y="3" width="15.6" height="18" rx="2.8"/><path d="M8 8.5h8m-8 3.5h5m-5 4 1.8 1.8 4.2-4.3"/></>,
  bell: <><path d="M6.2 17.7h11.6L16.5 15V10a4.5 4.5 0 0 0-9 0v5l-1.3 2.7ZM10 20h4M12 2.5v2"/></>,
  project: <><rect x="3" y="4" width="7" height="6" rx="2"/><rect x="14" y="4" width="7" height="6" rx="2"/><rect x="8.5" y="15" width="7" height="6" rx="2"/><path d="M6.5 10v2.2h11V10M12 12.2V15"/></>,
  document: <><path d="M6 2.8h8l4.2 4.3v13.1H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 2.8v4.5h4.2M8 12h7m-7 3.5h5"/></>,
  target: <><circle cx="11" cy="12" r="8.1"/><circle cx="11" cy="12" r="4"/><circle cx="11" cy="12" r=".8"/><path d="m16.5 6.5 4.2-4.2"/></>,
  handshake: <><path d="m3 9 3-3 4.1 1.2 2.3-1.2 3.2 1 2.4-1 3 3-3.2 5.7-3 1.3-3.4 3.1-3.5-3.7L6 14.7 3 9Z"/><path d="m9 11 2.1 1.7 2.5-1.4m-3.7 4.2 2.4 2.5m1-4.8 3.2 3"/></>,
  percent: <><circle cx="7.7" cy="7.7" r="2.2"/><circle cx="16.3" cy="16.3" r="2.2"/><path d="m5 19 14-14"/></>,
  wallet: <><rect x="3.2" y="6" width="17.6" height="14.4" rx="2.8"/><path d="M5 6V4.2h12.5M14.2 12h6.6v4.3h-6.6a2.2 2.2 0 0 1 0-4.3Z"/><circle cx="16.2" cy="14.2" r=".5"/></>,
  vat: <><path d="M5 3.3h14v17.4l-2.3-1.3-2.3 1.3-2.4-1.3-2.3 1.3-2.3-1.3L5 20.7V3.3Z"/><path d="M8.2 8.5h7.6m-7.6 3.2h7.6m-7.6 3.2h4"/></>,
  balance: <><path d="M3 19.5h18M5 16V9.5h3V16m3 0V5h3v11m3 0v-3.5h3V16"/><path d="M4.2 20.2h15.6"/></>,
  flow: <><path d="M3 7h11.5M11.5 4l3 3-3 3M21 17H9.5m3 3-3-3 3-3"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="7" r="2"/></>,
  debt: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-13 5h4m3.8-1.5 2.3 2.3-2.3 2.3"/></>,
  aging: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2m-8 4h3"/></>,
  asset: <><rect x="3" y="5" width="18" height="15" rx="2.8"/><path d="M7 5V3h10v2M3 11h18m-10 0v2h2v-2"/></>,
  depreciation: <><path d="M4 19h16M6 15V7h4v8m4 0V4h4v11M8 10h.1m8-2h.1"/><path d="m17 18 2 2 2-2"/></>,
  return: <><path d="M8 8H4V4m0 4a8.3 8.3 0 1 1-1 7"/><path d="M9 12h6m-3-3-3 3 3 3"/></>,
  ticket: <><path d="M4 5h16v4.2a2.8 2.8 0 0 0 0 5.6V19H4v-4.2a2.8 2.8 0 0 0 0-5.6V5Z"/><path d="M12 6.5v2m0 3v1m0 3v2"/></>,
  gift: <><rect x="3.5" y="9" width="17" height="12" rx="2"/><path d="M2.5 9h19V6.5H2.5V9ZM12 9v12M12 6.5c-4.5 0-5.7-1-5.7-2.6 0-2.2 3.1-2.4 5.7 2.6 2.6-5 5.7-4.8 5.7-2.6 0 1.6-1.2 2.6-5.7 2.6Z"/></>,
  chat: <><path d="M4 5.5A3 3 0 0 1 7 2.5h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9l-5 3V5.5Z"/><path d="M8 9.8h.2m3.7 0h.2m3.7 0h.2"/></>,
  ai: <><path d="m12 2 1.7 5.8L19.5 9l-5.8 1.7L12 16.5l-1.7-5.8L4.5 9l5.8-1.2L12 2ZM19.2 17.3l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z"/></>,
  book: <><path d="M12 5.5C9.5 4 6.5 3.6 3.4 4.4v14c3.1-.8 6.1-.4 8.6 1.1 2.5-1.5 5.5-1.9 8.6-1.1v-14C17.5 3.6 14.5 4 12 5.5Z"/><path d="M12 5.5v13m-6-9.8h3m6 0h3"/></>,
  classroom: <><rect x="3" y="4" width="18" height="15" rx="2.4"/><path d="M7 8h10M7 12h6M8 21v-2m8 2v-2"/></>,
  check: <><rect x="4" y="3" width="16" height="18" rx="2.8"/><path d="m7.5 10 1.8 1.8 3-3M14 10h3m-9.5 6 1.8 1.8 3-3M14 16h3"/></>,
  exam: <><rect x="3" y="5" width="18" height="16" rx="2.8"/><path d="M7.5 2.5v5M16.5 2.5v5M3 10h18m-12.5 5 2 2 4-4"/></>,
  room: <><path d="m3.5 8.5 8.5-5 8.5 5v12h-17v-12Z"/><path d="M9 20.5v-7h6v7m-8-11h10"/></>,
  device: <><rect x="3.2" y="4" width="17.6" height="12.5" rx="2.3"/><path d="M9 20h6m-3-3.5V20M7 8h10"/></>,
  roadmap: <><circle cx="5.5" cy="5.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/><path d="M7.5 5.5h7a4 4 0 0 1 0 8h-5a4 4 0 0 0-4 4v1h11"/></>,
  user: <><circle cx="12" cy="8" r="3.2"/><path d="M4.3 20v-1.5c0-3.5 3-5.8 7.7-5.8s7.7 2.3 7.7 5.8V20"/></>,
  lock: <><rect x="4.3" y="10" width="15.4" height="11" rx="2.6"/><path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3M12 14.5v2.5"/></>,
  scan: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/><circle cx="12" cy="12" r="3.5"/></>,
} satisfies Record<string, ReactNode>;

const labelToArtwork: Record<string, keyof typeof artwork> = {
  'Tổng quan': 'overview', 'Sản phẩm': 'package', 'Kho hàng': 'warehouse', 'Nhập hàng': 'inbound',
  'IMEI / Serial': 'barcode', 'Xuất hàng': 'outbound', 'Điều chuyển': 'transfer',
  'Giao dịch kho': 'list', 'Dự báo': 'forecast', 'Tra cứu bảo hành': 'shield',
  'Phiếu sửa chữa & Bảo hành': 'request', 'Báo cáo doanh thu & KTV': 'chart',
  'Lịch trình': 'clock', 'Lịch sử chấm công': 'history', 'Đơn từ': 'request',
  'Chấm công & Lịch làm việc': 'clock', 'Lịch nghỉ lễ': 'gift',
  'Giờ làm việc nhân viên': 'history', 'Tin tuyển dụng': 'document', 'Ứng viên': 'user', 'Phỏng vấn': 'chat',
  'Danh sách khách hàng': 'list', 'Cài đặt khách hàng': 'settings',
  'Lịch sử giao dịch': 'history', 'Mua hàng & bảo hành': 'bag', 'Dịch vụ & bảo hành': 'shield',
  'Công nợ': 'debt', 'Điểm thưởng': 'gift', 'Hồ sơ VAT': 'vat',
  'Thu - Chi': 'wallet', 'Lãi lỗ': 'chart', 'VAT': 'vat', 'Hòa vốn': 'balance',
  'Sổ quỹ & dòng tiền': 'flow', 'Tuổi nợ': 'aging', 'Nhắc nợ': 'bell',
  'Tài sản': 'asset', 'Khấu hao': 'depreciation', 'Kiểm kê': 'check',
  'Cài đặt tự động': 'settings', 'Nhật ký gửi': 'history',
  'Tạo chiến dịch': 'ai',
  'Phễu khách hàng': 'target', 'Hộp thư hội thoại': 'chat', 'AI phản hồi bình luận': 'ai',
  'Hạn mức': 'chart', 'Gói nâng cấp': 'gift',
  'Đối tác & hoa hồng': 'handshake', 'Chính sách': 'document', 'Hoa hồng sản phẩm': 'percent',
  'Bảo hành': 'shield', 'Đơn hàng': 'bag', 'Đổi trả': 'return', 'Hóa đơn': 'receipt',
  'Báo cáo': 'chart', 'Ca POS': 'clock', 'Ưu đãi và điểm': 'gift', 'Cài đặt': 'settings',
  'Mã ưu đãi': 'ticket', 'Khóa học': 'book', 'Lớp học': 'classroom',
  'Chất lượng học viên': 'check', 'Học viên': 'user', 'Học phí': 'wallet',
  'Lịch thi': 'exam', 'Phòng học': 'room', 'Thiết bị': 'device',
  'Thông báo': 'bell', 'Bảo lưu & học lại': 'return', 'Lộ trình & chờ lớp': 'roadmap',
  'Đối tác': 'handshake', 'Chính sách hoa hồng': 'document', 'KPI giới thiệu': 'target',
  'Đối soát': 'balance', 'Dự án': 'project', 'Danh sách tài khoản': 'list',
  'Vai trò và phân quyền': 'lock', 'Hồ sơ cá nhân': 'user', 'Bảo mật': 'lock',
  'Cấu hình ERP': 'settings', 'Nhận diện khuôn mặt': 'scan',
  'Cấp gói người dùng': 'user', 'Gói dịch vụ': 'package',
  'Cấu hình chung': 'settings', 'Học viên & Email': 'book',
};

/** Return custom artwork for known menu labels; unknown labels keep their supplied icon. */
export function getSidebarMenuIcon(label: string): ReactNode {
  const menuLabel = label.trim();
  const hrName = hrIcons[menuLabel];
  if (hrName) return <HrSidebarIcon name={hrName} />;
  const name = labelToArtwork[menuLabel] ?? (menuLabel.startsWith('Danh mục gói') ? 'list' : undefined);
  if (!name) return null;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{artwork[name]}</svg>;
}
