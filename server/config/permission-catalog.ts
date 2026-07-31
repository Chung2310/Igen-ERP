/**
 * Danh m?c quy?n h? th?ng � ngu?n s? th?t duy nh?t cho c�c m� quy?n
 * du?c `requirePermission` enforce v� UI super-admin hi?n th?.
 * M� quy?n ph?i kh?p ch�nh x�c chu?i d�ng trong middleware/route.
 */
export interface PermissionCatalogEntry {
  code: string;
  label: string;
  group: string;
  description?: string;
}

export const RECRUITMENT_PERMISSION = "recruitment:manage";

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { code: "user:read", label: "Xem ngu?i d�ng", group: "Ngu?i d�ng" },
  { code: "user:manage", label: "Qu?n l� ngu?i d�ng", group: "Ngu?i d�ng" },
  { code: "face:manage", label: "Qu?n l� d? li?u khu�n m?t", group: "Ngu?i d�ng" },
  { code: "kanban:read", label: "Xem c�ng vi?c", group: "C�ng vi?c & D? �n" },
  { code: "kanban:manage", label: "Qu?n l� c�ng vi?c", group: "C�ng vi?c & D? �n" },
  { code: "project:read", label: "Xem d? �n", group: "C�ng vi?c & D? �n" },
  { code: "project:manage", label: "Qu?n l� d? �n", group: "C�ng vi?c & D? �n" },
  { code: "stock:read", label: "Xem kho", group: "Kho & S?n ph?m" },
  { code: "stock:manage", label: "Qu?n l� kho", group: "Kho & S?n ph?m" },
  { code: "hr:read", label: "Xem nh�n s?", group: "Nh�n s?" },
  { code: "timekeeping:read", label: "Xem ch?m c�ng", group: "Nh�n s?" },
  { code: "timekeeping:manage", label: "Qu?n l� & duy?t ch?m c�ng", group: "Nh�n s?" },
  { code: "leave:approve", label: "Duy?t don ngh? ph�p", group: "Nh�n s?" },
  { code: "payroll:read", label: "Xem b?ng luong", group: "Nh�n s?" },
  { code: "payroll:prepare", label: "Chu?n b? d? li?u luong", group: "Nh�n s?", description: "T?o k? luong, d?ng b? v� kh�a d? li?u ch?m c�ng tru?c khi t�nh luong" },
  { code: "payroll:manage", label: "Qu?n l� & t�nh luong", group: "Nh�n s?" },
  { code: "payroll:pay", label: "Thanh toán bảng lương", group: "Nhân sự" },
  { code: "student:read", label: "Xem h?c vi�n/kh�ch h�ng", group: "H?c vi�n & Kh�ch h�ng" },
  { code: "student:manage", label: "Qu?n l� h?c vi�n/kh�ch h�ng", group: "H?c vi�n & Kh�ch h�ng" },
  { code: "student-profile:read", label: "Xem h? so h?c vi�n/lao d?ng", group: "H?c vi�n & Lao d?ng", description: "Xem danh s�ch v� th�ng tin h? so h?c vi�n ho?c lao d?ng trong ph?m vi chi nh�nh." },
  { code: "student-profile:manage", label: "Qu?n l� h? so h?c vi�n/lao d?ng", group: "H?c vi�n & Lao d?ng", description: "Th�m, s?a, x�a, nh?p d? li?u v� g�n chi nh�nh cho h? so h?c vi�n ho?c lao d?ng." },
  { code: "course:read", label: "Xem kh�a h?c", group: "��o t?o", description: "Xem danh s�ch, n?i dung v� th�ng tin c�c kh�a h?c." },
  { code: "course:manage", label: "Qu?n l� kh�a h?c", group: "��o t?o", description: "T?o, c?p nh?t, ph�n lo?i v� x�a kh�a h?c." },
  { code: "batch:read", label: "Xem l?p h?c/d? �n", group: "��o t?o", description: "Xem l?p h?c, d? �n, h?c vi�n v� gi�o vi�n du?c ph�n c�ng." },
  { code: "batch:manage", label: "Qu?n l� l?p h?c/d? �n", group: "��o t?o", description: "M? l?p ho?c d? �n, ph�n c�ng gi�o vi�n v� qu?n l� th�nh vi�n." },
  { code: "exam:read", label: "Xem l?ch thi", group: "��o t?o", description: "Xem d?t thi, l?ch thi v� k?t qu? thi." },
  { code: "exam:manage", label: "Qu?n l� l?ch thi", group: "��o t?o", description: "T?o, c?p nh?t, x�a d?t thi v� nh?p k?t qu? thi." },
  { code: "payment:read", label: "Xem h?c ph� v� thanh to�n", group: "T�i ch�nh h?c vi�n", description: "Xem c�ng n?, h?c ph� v� l?ch s? thanh to�n c?a h?c vi�n." },
  { code: "payment:manage", label: "Qu?n l� h?c ph� v� thanh to�n", group: "T�i ch�nh h?c vi�n", description: "Ghi nh?n, c?p nh?t v� x? l� c�c kho?n thanh to�n h?c vi�n." },
  { code: "student-notification:read", label: "Xem th�ng b�o h?c vi�n", group: "N?i dung & Li�n l?c", description: "Xem n?i dung v� l?ch s? th�ng b�o g?i cho h?c vi�n." },
  { code: "student-notification:manage", label: "Qu?n l� th�ng b�o h?c vi�n", group: "N?i dung & Li�n l?c", description: "So?n, g?i, c?p nh?t v� x�a th�ng b�o h?c vi�n." },
  { code: "student-resource:read", label: "Xem t�i nguy�n h?c t?p", group: "N?i dung & Li�n l?c", description: "Xem v� t?i t�i nguy�n h?c t?p trong module h?c vi�n." },
  { code: "student-resource:manage", label: "Qu?n l� t�i nguy�n h?c t?p", group: "N?i dung & Li�n l?c", description: "T?o, t?i l�n, c?p nh?t v� x�a t�i nguy�n h?c t?p." },
  { code: "assignment:read", label: "Xem b�i t?p v� di?m danh", group: "��o t?o", description: "Xem b�i t?p, b�i n?p v� d? li?u di?m danh l?p h?c." },
  { code: "assignment:manage", label: "Qu?n l� b�i t?p v� di?m danh", group: "��o t?o", description: "T?o b�i t?p, ch?m b�i v� qu?n l� d? li?u di?m danh." },
  { code: "custom-field:manage", label: "Qu?n l� tru?ng d? li?u t�y ch?nh", group: "C?u h�nh d? li?u", description: "T?o, s?a, luu tr? v� x�a tru?ng d? li?u t�y ch?nh c?a module h?c vi�n." },
  { code: "student-settings:manage", label: "C?u h�nh module h?c vi�n", group: "C?u h�nh h? th?ng", description: "Thi?t l?p lo?i d?i tu?ng v� c�ch v?n h�nh module qu?n l� h?c vi�n." },
  { code: "company-smtp:manage", label: "C?u h�nh SMTP doanh nghi?p", group: "C?u h�nh h? th?ng", description: "Xem, c?p nh?t, x�c minh v� g?i th? b?ng m�y ch? SMTP doanh nghi?p." },
  { code: "partner:read", label: "Xem d?i t�c & c?ng t�c vi�n", group: "�?i t�c" },
  { code: "partner:manage", label: "Qu?n l� d?i t�c & hoa h?ng", group: "�?i t�c" },
  { code: "chat:read", label: "Xem tr� chuy?n", group: "Tr� chuy?n" },
  { code: "resource:read", label: "Xem t�i nguy�n", group: "T�i nguy�n" },
  { code: "resource:manage", label: "Qu?n l� t�i nguy�n & k?t n?i Google Drive", group: "T�i nguy�n" },
  { code: "company-email:manage", label: "Qu?n l� email ch�c m?ng", group: "Nh�n s?" },
  { code: RECRUITMENT_PERMISSION, label: "Qu?n l� tuy?n d?ng", group: "Nh�n s?" },
];

export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);
