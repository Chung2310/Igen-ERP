# Phiếu nhập từ bán hàng

Trả hàng và thu mua lại tạo phiếu nhập đã xác nhận, liên kết với chứng từ xử lý và đơn bán gốc. Hủy đơn đã xuất kho cũng tạo phiếu nhập. Phiếu nhập là nguồn của biến động tồn; không cộng tồn thêm lần thứ hai từ chứng từ trả/thu mua.

Đơn lưu trạng thái xử lý riêng, giữ trạng thái bán hàng và thanh toán để không làm sai báo cáo. Danh sách và chi tiết đơn đọc cả lịch sử chứng từ cũ để hiển thị xử lý một phần/toàn bộ. Không cho hủy toàn bộ đơn đã xử lý trả/thu mua; phần hàng còn lại được xử lý bằng phiếu trả hàng.

Các bước tạo chứng từ, tạo phiếu nhập, cập nhật tồn, IMEI và đơn chạy trong một MongoDB transaction, tương tự bước xác nhận/hủy đơn bán. Cần MongoDB replica set hoặc sharded cluster.

## Bổ sung phiếu nhập cho chứng từ trả/thu mua cũ

Chạy trên môi trường có cấu hình kết nối cơ sở dữ liệu, xác định công ty và chi nhánh cụ thể:

```powershell
npx tsx server/scripts/backfill-retail-restock-receipts.ts --company=ACME --branch=BRANCH_ID
```

Mặc định chỉ kiểm tra. Thêm `--apply` để tạo phiếu nhập:

```powershell
npx tsx server/scripts/backfill-retail-restock-receipts.ts --company=ACME --branch=BRANCH_ID --apply
```

Chỉ bổ sung phiếu khi sổ kho có đầy đủ dòng nhập, đúng SKU, số lượng và kho. Dùng lại khóa biến động cũ nên không cộng tồn, không hoàn tiền và không thay đổi trạng thái IMEI lần nữa. Có thể chạy lặp lại. Những chứng từ báo `needs_review` chưa có sổ kho khớp và được giữ nguyên để đối soát, không tự suy đoán rằng đã nhập hàng.
