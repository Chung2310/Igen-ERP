import XLSX from "xlsx";
import path from "path";

const data = [
  {
    "SKU": "MP001",
    "Tên sản phẩm": "Kem chống nắng Skin1004 SPF50+",
    "Danh mục": "Kem chống nắng",
    "Thương hiệu": "Skin1004",
    "Đơn vị tính": "Tuýp",
    "Giá bán": 350000,
    "Tồn kho": 100,
    "Mô tả": "Kem chống nắng cho da",
    "Trạng thái": "Active"
  },
  {
    "SKU": "MP002",
    "Tên sản phẩm": "Sữa rửa mặt CeraVe Foaming",
    "Danh mục": "Sữa rửa mặt",
    "Thương hiệu": "CeraVe",
    "Đơn vị tính": "Chai",
    "Giá bán": 320000,
    "Tồn kho": 80,
    "Mô tả": "Làm sạch da",
    "Trạng thái": "Active"
  },
  {
    "SKU": "MP003",
    "Tên sản phẩm": "Nước tẩy trang Bioderma Hồng",
    "Danh mục": "Tẩy trang",
    "Thương hiệu": "Bioderma",
    "Đơn vị tính": "Chai",
    "Giá bán": 420000,
    "Tồn kho": 50,
    "Mô tả": "Dành cho da nhạy cảm",
    "Trạng thái": "Active"
  }
];

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "SanPham");

const outputPath = "d:\\cty\\Igen-ERP\\scratch\\test_products.xlsx";
XLSX.writeFile(workbook, outputPath);
console.log("Excel file generated at:", outputPath);
