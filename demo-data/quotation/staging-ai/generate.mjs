import XLSX from "xlsx";
import JSZip from "jszip";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const products = [
  ["STGAI-LED-PANEL-40W", "Đèn LED panel 600 x 600 mm 40W", "Ánh sáng trung tính 4000K, lắp âm trần", "cái", 520000, 18],
  ["STGAI-DOWNLIGHT-12W", "Đèn downlight âm trần 12W", "Viền trắng, ánh sáng trung tính", "cái", 185000, 12],
  ["STGAI-LED-DAY-24V", "Dây LED 24V trang trí", "Ánh sáng trung tính, chuẩn IP20", "m", 90000, 30],
  ["STGAI-NGUON-24V-150W", "Nguồn LED 24V 150W", "Nguồn cho dây LED 24V", "cái", 450000, 4],
  ["STGAI-CONG-TAC-2C", "Công tắc 2 chiều âm tường", "Dòng định mức 16A, mặt trắng", "cái", 120000, 10],
  ["STGAI-O-CAM-DOI", "Ổ cắm đôi âm tường", "Ổ cắm có tiếp địa, mặt trắng", "cái", 98000, 16],
  ["STGAI-DAY-CV25", "Dây điện CV 2,5 mm2", "Lõi đồng, cách điện PVC", "m", 19500, 200],
  ["STGAI-DAY-CV4", "Dây điện CV 4 mm2", "Lõi đồng, cách điện PVC", "m", 31000, 100],
  ["STGAI-ONG-PVC-D20", "Ống luồn dây PVC D20", "Ống cứng chống cháy, đường kính 20 mm", "m", 12000, 180],
  ["STGAI-HOP-NOI-AM", "Hộp nối dây âm tường", "Hộp nhựa chống cháy, có nắp", "cái", 28000, 24],
  ["STGAI-TU-DIEN-24M", "Tủ điện phân phối 24 module", "Tủ có ray DIN, nắp che và thanh đấu nối", "bộ", 1750000, 1],
  ["STGAI-MCB-1P-20A", "Aptomat MCB 1 pha 20A", "Bảo vệ quá tải và ngắn mạch", "cái", 165000, 8],
  ["STGAI-RCCB-2P-40A", "Aptomat chống rò RCCB 2P 40A", "Dòng rò 30 mA", "cái", 780000, 2],
  ["STGAI-MANG-CAP-6040", "Máng cáp nhựa 60 x 40 mm", "Máng có nắp, màu trắng", "m", 85000, 35],
  ["STGAI-CAT6", "Cáp mạng CAT6 UTP", "Lõi đồng, băng thông 250 MHz", "m", 18000, 180],
  ["STGAI-OCAM-CAT6", "Ổ cắm mạng CAT6 âm tường", "Ổ cắm 1 cổng RJ45, mặt trắng", "cái", 135000, 12],
  ["STGAI-CAMERA-4MP", "Camera IP 4MP PoE", "Camera trong nhà, hồng ngoại", "cái", 1650000, 4],
  ["STGAI-SWITCH-POE-8", "Switch PoE 8 cổng", "8 cổng PoE, 2 cổng uplink", "cái", 3200000, 1],
  ["STGAI-NHAN-CONG", "Nhân công lắp đặt điện và mạng", "Thi công, đấu nối và kiểm tra tại công trình", "ngày", 650000, 12],
  ["STGAI-KHAO-SAT", "Khảo sát và thiết kế bản vẽ điện mạng", "Khảo sát hiện trạng và bàn giao bản vẽ bố trí", "gói", 2500000, 1],
  ["STGAI-NGHIEM-THU", "Kiểm tra và nghiệm thu hệ thống", "Đo kiểm điện, thử mạng và lập biên bản", "gói", 1200000, 1],
  ["STGAI-DU-PHONG", "Vật tư phụ lắp đặt", "Đầu nối, vít, băng keo và phụ kiện phụ", "gói", 950000, 1],
];
const requested = products.slice(0, 20);

function saveWorkbook(path, sheetName, rows, widths) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map(wch => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, join(directory, path));
}

function templateRows(title) {
  const rows = [
    [title],
    ["Bên bán:", "Doanh nghiệp trên staging"],
    ["Khách hàng:", "[TEST STAGING] Công ty An Phát Văn Phòng"],
    ["Mã chứng từ:", "", "Ngày:", ""],
    ["Dự án:", "Cải tạo điện, chiếu sáng và mạng văn phòng 120 m2"],
    [],
    ["STT", "Mã hàng", "Tên sản phẩm / hạng mục", "Quy cách / mô tả", "Đơn vị", "Số lượng", "Đơn giá (VND)", "Thành tiền (VND)"],
  ];
  for (let number = 1; number <= 25; number += 1) rows.push([number, "", "", "", "", "", "", ""]);
  rows.push([], ["", "", "", "", "", "", "Tạm tính", ""], ["", "", "", "", "", "", "Thuế suất VAT (%)", ""], ["", "", "", "", "", "", "Tiền VAT", ""], ["", "", "", "", "", "", "Phí vận chuyển", ""], ["", "", "", "", "", "", "Tổng thanh toán", ""], [], ["Ghi chú:", "Dữ liệu thử nghiệm staging; xác nhận VAT, vận chuyển và điều kiện trước khi gửi khách."]);
  return rows;
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function saveRequestDocx() {
  const lines = [
    "YÊU CẦU BÁO GIÁ / DỰ TOÁN - DỮ LIỆU THỬ NGHIỆM STAGING",
    "Khách hàng: [TEST STAGING] Công ty An Phát Văn Phòng",
    "Dự án: Cải tạo hệ thống điện, chiếu sáng và mạng cho văn phòng 120 m2, một tầng.",
    "Hãy lập dự toán bằng AI từ bảng giá đã khai báo, giữ đúng SKU, số lượng và đơn vị. Không tự thêm sản phẩm ngoài danh mục.",
    "Danh sách hạng mục cần báo giá:",
    ...requested.map(([sku, name, , unit, , amount], index) => `${index + 1}. ${name} | SKU ${sku} | Số lượng ${amount} ${unit}.`),
    "Chưa xác định thuế suất VAT và phí vận chuyển; hãy hỏi bổ sung thay vì tự giả định.",
    "Yêu cầu thể hiện tạm tính, VAT, vận chuyển và tổng thanh toán sau khi các thông tin đó được xác nhận.",
    "Đây là dữ liệu kiểm thử trên staging, không phải giao dịch thật.",
  ];
  const body = lines.map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  await writeFile(join(directory, "yeu-cau-khach-staging-AI.docx"), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  await writeFile(join(directory, "yeu-cau-khach-staging-AI.txt"), lines.join("\n") + "\n", "utf8");
}

await mkdir(directory, { recursive: true });
saveWorkbook("bang-gia-staging-AI.xlsx", "Bang gia", [["Mã hàng", "Tên sản phẩm", "Quy cách / mô tả", "Đơn vị", "Đơn giá", "Tiền tệ"], ...products.map(([sku, name, description, unit, price]) => [sku, name, description, unit, price, "VND"])], [24, 43, 58, 13, 18, 12]);
saveWorkbook("mau-du-toan-staging-AI.xlsx", "Du toan", templateRows("DỰ TOÁN - KIỂM THỬ AI TRÊN STAGING"), [8, 25, 43, 58, 12, 12, 18, 20]);
saveWorkbook("mau-bao-gia-khach-staging-AI.xlsx", "Bao gia", templateRows("BÁO GIÁ KHÁCH HÀNG - KIỂM THỬ AI TRÊN STAGING"), [8, 25, 43, 58, 12, 12, 18, 20]);
await saveRequestDocx();
const expectedLines = requested.map(([sku, name, , unit, price, quantity]) => ({ sku, name, unit, quantity, unitPrice: price, lineTotal: price * quantity }));
await writeFile(join(directory, "expected-result.json"), JSON.stringify({
  customerName: "[TEST STAGING] Công ty An Phát Văn Phòng",
  currency: "VND",
  subtotal: expectedLines.reduce((sum, line) => sum + line.lineTotal, 0),
  taxRate: null,
  shippingFee: null,
  lines: expectedLines,
}, null, 2) + "\n", "utf8");
console.log(`Generated 22 catalog products, 20 requested lines, two Excel templates and request DOCX/TXT in ${directory}`);
