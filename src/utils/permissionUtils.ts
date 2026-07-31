export interface PermissionDefinition {
  code: string;
  label: string;
  description?: string;
  group?: string;
}

export const PERMISSION_TRANSLATIONS: Record<string, { label: string; group?: string; description?: string }> = {
  "*": {
    label: "To�n quy?n h? th?ng",
    group: "Qu?n tr? cao c?p",
    description: "Cho ph�p truy c?p v� qu?n tr? t?t c? c�c t�nh nang trong h? th?ng",
  },
  // Qu?n l� nh�n s? & Ch?m c�ng
  "user:read": {
    label: "Xem th�ng tin nh�n s?",
    group: "Qu?n l� nh�n s?",
    description: "Xem danh s�ch t�i kho?n, so d? t? ch?c v� th�ng tin nh�n vi�n",
  },
  "user:manage": {
    label: "Qu?n tr? nh�n s? & t�i kho?n",
    group: "Qu?n l� nh�n s?",
    description: "Th�m m?i, ch?nh s?a th�ng tin, d?t vai tr� v� x�a t�i kho?n nh�n vi�n",
  },
  "hr:read": {
    label: "Xem t?ng quan nh�n s?",
    group: "Qu?n l� nh�n s?",
    description: "Xem th? v� bi?u d? nh�n s? tr�n trang T?ng quan. Luu �: d? d�ng module NH�N S? (so d? t? ch?c, l?ch, kanban) c?n c?p th�m quy?n \"Xem th�ng tin nh�n s?\" (user:read) d? t?i du?c danh s�ch nh�n vi�n.",
  },
  "timekeeping:read": {
    label: "Xem b?ng ch?m c�ng",
    group: "Qu?n l� nh�n s?",
    description: "Xem d? li?u di?m danh, l?ch l�m vi?c v� b?ng ch?m c�ng ng�y/th�ng",
  },
  "leave:approve": { label: "Duy?t don ngh? ph�p", group: "Qu?n l� nh�n s?", description: "Ph� duy?t ho?c t? ch?i don ngh? ph�p v� ph�n lo?i ngh? ch�nh d�ng/kh�ng ch�nh d�ng" },
  "timekeeping:manage": {
    label: "Qu?n l� & duy?t ch?m c�ng",
    group: "Qu?n l� nh�n s?",
    description: "Duy?t don xin ngh?, ch?nh s?a b?n ghi ch?m c�ng v� c?u h�nh ca l�m vi?c",
  },
  "payroll:read": {
    label: "Xem b?ng luong nh�n s?",
    group: "Qu?n l� nh�n s?",
    description: "Xem phi?u luong, ph? c?p v� b?ng t�nh luong nh�n vi�n",
  },
  "payroll:prepare": {
    label: "Chu?n b? d? li?u luong nh�n s?",
    group: "Qu?n l� nh�n s?",
    description: "T?o k? luong, d?ng b? v� kh�a d? li?u ch?m c�ng tru?c khi t�nh luong",
  },
  "payroll:pay": { label: "Thanh toán bảng lương", description: "Xác nhận và hoàn tất thanh toán payroll" },
  "payroll:manage": {
    label: "Qu?n l� & t�nh luong nh�n s?",
    group: "Qu?n l� nh�n s?",
    description: "T?o b?ng luong, duy?t thu?ng v� ch?t k? tr? luong cho c�ng ty",
  },
  "face:manage": {
    label: "Qu?n l� ch?m c�ng khu�n m?t AI",
    group: "Qu?n l� nh�n s?",
    description: "C?u h�nh d? li?u v� nh?n di?n khu�n m?t ch?m c�ng AI",
  },
  // Qu?n l� d�o t?o & H?c vi�n
  "student:read": {
    label: "Xem danh s�ch h?c vi�n",
    group: "Qu?n l� d�o t?o",
    description: "Xem danh s�ch h?c vi�n, l?p h?c v� k?t qu? d�o t?o",
  },
  "student:manage": {
    label: "Qu?n l� h?c vi�n & x?p l?p",
    group: "Qu?n l� d�o t?o",
    description: "Th�m m?i h?c vi�n, x?p l?p, di?m danh v� c?p ch?ng ch?",
  },
  "student-profile:read": { label: "Xem h? so h?c vi�n/lao d?ng", group: "H?c vi�n & Lao d?ng", description: "Xem danh s�ch v� th�ng tin h? so trong ph?m vi chi nh�nh" },
  "student-profile:manage": { label: "Qu?n l� h? so h?c vi�n/lao d?ng", group: "H?c vi�n & Lao d?ng", description: "Th�m, s?a, x�a, nh?p d? li?u v� g�n chi nh�nh cho h? so" },
  "partner:read": {
    label: "Xem d?i t�c & c?ng t�c vi�n",
    group: "Qu?n l� �?i t�c",
    description: "Xem danh s�ch, chi ti?t, s? li?u gi?i thi?u v� hoa h?ng d?i t�c",
  },
  "partner:manage": {
    label: "Qu?n l� d?i t�c & hoa h?ng",
    group: "Qu?n l� �?i t�c",
    description: "Th�m, s?a, x�a, nh?p Excel, c?u h�nh level v� ghi nh?n chi tr? hoa h?ng",
  },
  "course:read": {
    label: "Xem danh s�ch kh�a h?c",
    group: "Qu?n l� d�o t?o",
    description: "Xem th�ng tin kh�a h?c, l? tr�nh v� gi�o tr�nh d�o t?o",
  },
  "course:manage": {
    label: "Qu?n l� kh�a h?c & chuong tr�nh",
    group: "Qu?n l� d�o t?o",
    description: "T?o kh�a h?c m?i, thi?t l?p h?c ph?n v� ph�n c�ng gi?ng vi�n",
  },
  "batch:read": { label: "Xem l?p h?c/d? �n", group: "��o t?o", description: "Xem l?p h?c, d? �n v� th�nh vi�n du?c ph�n c�ng" },
  "batch:manage": { label: "Qu?n l� l?p h?c/d? �n", group: "��o t?o", description: "M? l?p, ph�n c�ng gi�o vi�n v� qu?n l� th�nh vi�n" },
  "exam:read": { label: "Xem l?ch thi", group: "��o t?o", description: "Xem d?t thi, l?ch thi v� k?t qu?" },
  "exam:manage": { label: "Qu?n l� l?ch thi", group: "��o t?o", description: "T?o, c?p nh?t, x�a d?t thi v� nh?p k?t qu?" },
  "payment:read": { label: "Xem h?c ph� v� thanh to�n", group: "T�i ch�nh h?c vi�n", description: "Xem c�ng n?, h?c ph� v� l?ch s? thanh to�n" },
  "payment:manage": { label: "Qu?n l� h?c ph� v� thanh to�n", group: "T�i ch�nh h?c vi�n", description: "Ghi nh?n v� x? l� c�c kho?n thanh to�n h?c vi�n" },
  "student-notification:read": { label: "Xem th�ng b�o h?c vi�n", group: "N?i dung & Li�n l?c", description: "Xem n?i dung v� l?ch s? th�ng b�o h?c vi�n" },
  "student-notification:manage": { label: "Qu?n l� th�ng b�o h?c vi�n", group: "N?i dung & Li�n l?c", description: "So?n, g?i, c?p nh?t v� x�a th�ng b�o h?c vi�n" },
  "student-resource:read": { label: "Xem t�i nguy�n h?c t?p", group: "N?i dung & Li�n l?c", description: "Xem v� t?i t�i nguy�n trong module h?c vi�n" },
  "student-resource:manage": { label: "Qu?n l� t�i nguy�n h?c t?p", group: "N?i dung & Li�n l?c", description: "T?o, t?i l�n, c?p nh?t v� x�a t�i nguy�n h?c t?p" },
  "assignment:read": { label: "Xem b�i t?p v� di?m danh", group: "��o t?o", description: "Xem b�i t?p, b�i n?p v� d? li?u di?m danh" },
  "assignment:manage": { label: "Qu?n l� b�i t?p v� di?m danh", group: "��o t?o", description: "T?o b�i t?p, ch?m b�i v� qu?n l� di?m danh" },
  "custom-field:manage": { label: "Qu?n l� tru?ng d? li?u t�y ch?nh", group: "C?u h�nh d? li?u", description: "C?u h�nh tru?ng d? li?u t�y ch?nh c?a module h?c vi�n" },
  "student-settings:manage": { label: "C?u h�nh module h?c vi�n", group: "C?u h�nh h? th?ng", description: "Thi?t l?p lo?i d?i tu?ng v� c�ch v?n h�nh module h?c vi�n" },
  "company-smtp:manage": { label: "C?u h�nh SMTP doanh nghi?p", group: "C?u h�nh h? th?ng", description: "Xem, c?p nh?t, x�c minh v� g?i th? SMTP doanh nghi?p" },
  // Kho & S?n ph?m
  "stock:read": {
    label: "Xem t?n kho & s?n ph?m",
    group: "Kho & S?n ph?m",
    description: "Xem l?ch s? t?n kho, th�ng tin s?n ph?m v� nh?t k� xu?t nh?p h�ng",
  },
  "stock:manage": {
    label: "Qu?n l� xu?t nh?p kho",
    group: "Kho & S?n ph?m",
    description: "T?o phi?u nh?p kho, xu?t kho v� di?u ch?nh s? lu?ng t?n kho",
  },
  "product:manage": {
    label: "Qu?n l� danh m?c & b?ng gi�",
    group: "Kho & S?n ph?m",
    description: "T?o m?i s?n ph?m, c?p nh?t gi� b�n v� thi?t l?p ngu?ng c?nh b�o t?n kho",
  },
  // C�ng vi?c & D? �n
  "kanban:read": {
    label: "Xem c�ng vi?c Kanban",
    group: "C�ng vi?c & D? �n",
    description: "Xem danh s�ch v� tr?ng th�i th? c�ng vi?c tr�n b?ng Kanban",
  },
  "kanban:manage": {
    label: "Qu?n l� & giao vi?c Kanban",
    group: "C�ng vi?c & D? �n",
    description: "T?o c�ng vi?c m?i, k�o th? ti?n d?, ph�n c�ng ngu?i th?c hi?n",
  },
  "project:read": {
    label: "Xem danh s�ch d? �n",
    group: "C�ng vi?c & D? �n",
    description: "Xem t?ng quan danh s�ch c�c d? �n dang tri?n khai",
  },
  "project:manage": {
    label: "Qu?n tr? & thi?t l?p d? �n",
    group: "C�ng vi?c & D? �n",
    description: "T?o d? �n m?i, c�i d?t th�nh vi�n v� qu?n l� ti?n d? d? �n",
  },
  // Tr� chuy?n & Trao d?i
  "chat:read": {
    label: "Tham gia tr� chuy?n n?i b?",
    group: "Tr� chuy?n & Trao d?i",
    description: "G?i tin nh?n, trao d?i v� nh?n th�ng b�o trong ph�ng chat c�ng ty",
  },
  "chat:manage": {
    label: "Qu?n l� nh�m & k�nh chat",
    group: "Tr� chuy?n & Trao d?i",
    description: "T?o ph�ng chat m?i, qu?n l� th�nh vi�n v� ghim th�ng b�o quan tr?ng",
  },
  // T�i nguy�n & T�i li?u
  "resource:read": {
    label: "Xem thu vi?n t�i nguy�n",
    group: "T�i li?u & T�i nguy�n",
    description: "Xem v� t?i v? c�c file t�i li?u, m?u bi?u du?c chia s?",
  },
  "resource:manage": {
    label: "Qu?n l� thu vi?n t�i nguy�n",
    group: "T�i li?u & T�i nguy�n",
    description: "T?i l�n, ph�n quy?n xem v� qu?n l� file t�i li?u h? th?ng",
  },
  // T�i ch�nh & V�
  "wallet:read": {
    label: "Xem s? du & l?ch s? v�",
    group: "T�i ch�nh & V�",
    description: "Xem th�ng tin s? du t�i kho?n v� l?ch s? giao d?ch n?p/r�t",
  },
  "wallet:manage": {
    label: "Qu?n l� giao d?ch v�",
    group: "T�i ch�nh & V�",
    description: "Th?c hi?n giao d?ch n?p ti?n, n?p credit v� di?u ch?nh s? du v�",
  },
  // H? th?ng & C?u h�nh
  "settings:manage": {
    label: "C?u h�nh h? th?ng & doanh nghi?p",
    group: "H? th?ng & Ph�n quy?n",
    description: "Ch?nh s?a th�ng tin c�ng ty, t�ch h?p d?ch v? v� c?u h�nh ERP",
  },
  "role:manage": {
    label: "Qu?n l� vai tr� & ph�n quy?n",
    group: "H? th?ng & Ph�n quy?n",
    description: "T?o vai tr� t�y ch?nh, thi?t l?p ph�n quy?n chi ti?t cho nh�n vi�n",
  },
};

export const DEFAULT_SYSTEM_PERMISSIONS = Object.entries(PERMISSION_TRANSLATIONS)
  .filter(([code]) => code !== "*")
  .map(([code, val]) => ({
    _id: code,
    code,
    name: val.label,
    group: val.group || "H? th?ng",
    description: val.description,
  }));

/**
 * Tr? v? t�n hi?n th? ti?ng Vi?t th�n thi?n ngu?i d�ng cho m� quy?n.
 */
export function getPermissionLabel(code: string, fallbackName?: string): string {
  if (!code) return "";
  if (code === "*") return "To�n quy?n h? th?ng";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.label) {
    return mapped.label;
  }
  if (fallbackName && fallbackName !== code) {
    return fallbackName;
  }
  return code
    .replace(/^([a-z]+):([a-z]+)$/i, (_, mod, act) => {
      const actMap: Record<string, string> = { read: "Xem", manage: "Qu?n l�", post: "�ang b�i" };
      return `${actMap[act] || act} ${mod.toUpperCase()}`;
    });
}

/**
 * Tr? v? m� t? ti?ng Vi?t d? hi?u cho m� quy?n.
 */
export function getPermissionDescription(code: string, fallbackDesc?: string): string {
  if (!code) return "";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.description) {
    return mapped.description;
  }
  return fallbackDesc || "";
}

/**
 * Tr? v? t�n vai tr� ti?ng Vi?t th�n thi?n ngu?i d�ng.
 */
export function getRoleDisplayName(role: string, customDisplayName?: string): string {
  if (customDisplayName && customDisplayName !== role) {
    return customDisplayName;
  }
  const roleMap: Record<string, string> = {
    superadmin: "Qu?n tr? vi�n c?p cao",
    admin: "Qu?n tr? vi�n doanh nghi?p",
    branch_owner: "Ch? chi nh�nh",
    manager: "Qu?n l� chi nh�nh",
    user: "Nh�n vi�n",
    staff: "Nh�n vi�n",
    teacher: "Gi�o vi�n",
    accountant: "K? to�n",
  };
  return roleMap[role?.toLowerCase()] || role || "Nh�n vi�n";
}
