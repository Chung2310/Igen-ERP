# Dữ liệu kiểm thử Báo giá AI trên staging

Các file trong thư mục này là dữ liệu giả lập, không dùng cho giao dịch thật.

| File | Mục đích |
| --- | --- |
| `bang-gia-staging-AI.xlsx` | Import 22 sản phẩm và dịch vụ có SKU `STGAI-*`, đơn giá VND. |
| `mau-du-toan-staging-AI.xlsx` | Mẫu dự toán với 25 dòng sản phẩm và phần tổng tiền. |
| `mau-bao-gia-khach-staging-AI.xlsx` | Mẫu báo giá khách với 25 dòng sản phẩm. |
| `yeu-cau-khach-staging-AI.docx` | Yêu cầu khách hàng gồm 20 hạng mục; tải lên khi tạo dự toán bằng AI. |
| `yeu-cau-khach-staging-AI.txt` | Cùng nội dung ở dạng văn bản để nhập vào ô gợi ý AI của báo giá khách, vì luồng này chỉ nhận prompt. |
| `expected-result.json` | Đối chiếu 20 dòng, SKU, số lượng và tạm tính kỳ vọng 61.245.000 VND trước VAT/vận chuyển. |

Thứ tự sử dụng trên staging: import bảng giá và kiểm tra số lượng sản phẩm, tải lên mẫu dự toán và mẫu báo giá khách, tạo dự toán bằng file yêu cầu Word, sau đó thử chế độ AI của báo giá khách bằng nội dung TXT. Chỉ điền tên khách hàng giả lập `[TEST STAGING] Công ty An Phát Văn Phòng`; để trống email và điện thoại. VAT và phí vận chuyển được cố ý để chưa xác định nhằm kiểm tra bước hỏi bổ sung của AI.

Chạy `node demo-data/quotation/staging-ai/generate.mjs` để tạo lại các file từ cùng một bộ sản phẩm.
