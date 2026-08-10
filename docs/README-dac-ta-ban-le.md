# Bộ đặc tả triển khai Bán lẻ & Mở rộng ERP

Bộ tài liệu hiện thực hóa `ke-hoach-trien-khai-chuc-nang-ban-le-ranking-chi-tiet timeline.md` thành đặc tả kỹ thuật thi công được.

## Thứ tự đọc

| # | Tài liệu | Nội dung | Đọc khi |
|---|---|---|---|
| 0 | **[dac-ta-lien-ket-module.md](dac-ta-lien-ket-module.md)** | Event bus, ma trận sở hữu dữ liệu, nợ tenancy, luồng xuyên module | **Bắt buộc đọc trước mọi file khác** |
| 1 | [dac-ta-model-retail.md](dac-ta-model-retail.md) | 7 model của `retail` — schema, index, state machine, invariant | Làm A1, A2, A3, A6, A13, B8 |
| 2 | [dac-ta-api-fe-retail.md](dac-ta-api-fe-retail.md) | API + FE của `retail` — file đặt đâu, component nào, màn hình gì | Làm P0/P1 |
| 3 | [dac-ta-module-crm.md](dac-ta-module-crm.md) | `Customer` + phân hạng A8 | **Đợt 1 cần trước P0** |
| 4 | [dac-ta-module-finance.md](dac-ta-module-finance.md) | Công nợ A4, nhắc nợ A12, chi phí A7, tài sản A11 | Sau retail |
| 5 | [dac-ta-module-partner-sales.md](dac-ta-module-partner-sales.md) | CTV/hoa hồng A9 + **trả nợ tenancy `ownerId`** | P2 |
| 6 | [dac-ta-module-repair.md](dac-ta-module-repair.md) | Sửa chữa D1–D4, đánh giá QR B6 | P2 |
| 7 | [dac-ta-module-marketing.md](dac-ta-module-marketing.md) | SMS/Zalo C2/C3, sàn TMĐT C5/C6, automation C7, đo lường C11 | P2–P3 |
| 8 | [dac-ta-mo-rong-module-co-san.md](dac-ta-mo-rong-module-co-san.md) | A10, A5/D4, E3, C1, C10, C8 — mở rộng module đã có | Xen kẽ |

## Bản đồ tính năng → nơi thi công

| Nhóm | Tính năng | Module |
|---|---|---|
| A | A1 A2 A3 A6 A13 | `retail` |
| | A4 A7 A11 A12 | `finance` |
| | A5 | mở rộng `analytics` |
| | A8 | `crm` (module key `customer`) |
| | A9 | `partner-sales` (tab `ĐỐI TÁC`) |
| | A10 | mở rộng `inventory` |
| B | B1 B2 B3 B4 B8 | `retail` |
| | B6 | `repair` |
| | B7 B9 | `marketing` (pilot P3) |
| | B5 | HOLD |
| C | C1 | `server/integrations/einvoice/` |
| | C2 C3 C4 C5 C6 C7 C11 | `marketing` |
| | C8 | mở rộng `chatbot` đã có |
| | C10 | hạ tầng bảo mật |
| | C9 | HOLD |
| D | D1 D2 D3 D4 | `repair` |
| E | E1 E2 E4 | **đã có** trong `hr` — cần xác nhận phạm vi |
| | E3 | mở rộng `hr` |
| | E5 E6 | P3 |

## Ba quyết định kiến trúc xuyên suốt

1. **Bước 0 trước mọi thứ** — `server/integrations/shared/` (event bus + `writeStockMovement`), 2 ngày. Không có nó thì 6 module sau phải gọi chéo nhau, và gỡ ra về sau tốn hơn nhiều.
2. **Idempotency ép ở tầng DB, không ở service.** Mọi ghi có thể lặp đều có unique index trên khóa idempotency, bắt `E11000` coi như thành công. Áp dụng cho `StockLog`, `CommissionEntry`, `Receivable`, `MessageLog`, `EInvoiceRequest`, `CustomerSpendEntry`.
3. **Số tiền, số dư, doanh số đều là ledger append-only.** Con số tổng chỉ là cache, có job đối soát. Không sửa, không xóa — sai thì ghi bút toán đảo.

## Ba điều cần nghiệp vụ chốt trước khi code

1. **Quy tắc ghi nhận doanh thu A5** — bảng câu hỏi ở `dac-ta-mo-rong-module-co-san.md` §2.3, cần kế toán ký.
2. **Phạm vi E1/E2/E4** — tôi đọc code thấy đã có sẵn và đề xuất cắt ~20 ngày, nhưng đây là suy luận từ code, chưa đối chiếu kỳ vọng nghiệp vụ.
3. **Backfill tenancy `Partner`** — script chạy `--dry-run` trước, cần người rà kết quả trước khi `--apply`.

## Điều chỉnh timeline so với tài liệu gốc

| | Gốc | Đề xuất |
|---|---|---|
| Bước 0 hạ tầng | không có | **+2 ngày** |
| Nhóm E (E1+E2+E4) | 20 ngày | **~1 ngày** (đã có sẵn) |
| C2, C8, A7 | 12 ngày | 6 ngày (đã có một phần) |
| A9, A10 | 7 ngày | 8.5 ngày (nợ tenancy + thiếu `Supplier`) |
| **Ròng** | | **giảm ~21 ngày** |

