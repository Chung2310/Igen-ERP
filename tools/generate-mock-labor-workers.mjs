import * as XLSX from "xlsx";

const headers = [
  "Họ và tên",
  "Số điện thoại",
  "Mã đối tác giới thiệu",
  "Ngày sinh",
  "CCCD / CMND",
  "Email",
  "Địa chỉ",
  "Ngày tiếp nhận",
  "Loại lao động",
  "Quốc tịch",
  "Số GPLĐ / visa",
  "Ngày hết hạn GPLĐ / visa",
  "Ghi chú",
];

const pad = (value) => String(value).padStart(2, "0");
const rows = Array.from({ length: 200 }, (_, index) => {
  const number = index + 1;
  const birthday = `${pad((index % 27) + 1)}/${pad((index % 12) + 1)}/${1985 + (index % 15)}`;
  const registrationDate = `${pad((index % 28) + 1)}/08/2026`;
  const laborType = number % 2 === 0 ? "Thời vụ" : "Chính thức";

  return [
    `Người lao động ${pad(number)}`,
    `090${String(number).padStart(7, "0")}`,
    "123",
    birthday,
    `001085${String(number).padStart(6, "0")}`,
    `laodong${String(number).padStart(3, "0")}@example.com`,
    `Số ${number}, Quận Cầu Giấy, Hà Nội`,
    registrationDate,
    laborType,
    "Việt Nam",
    "",
    "",
    "Dữ liệu mẫu - có thể chỉnh sửa trước khi nhập",
  ];
});

const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
sheet["!cols"] = [
  { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 13 }, { wch: 16 }, { wch: 32 }, { wch: 32 },
  { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 42 },
];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Lao động mẫu");
XLSX.writeFile(workbook, "mock-labor-workers-200.xlsx");
