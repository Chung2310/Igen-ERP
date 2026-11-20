# Chạy kiểm tra và khảo sát vật tư

## Kiểm thử

`npm run test:supplies` chạy các test không cần database; integration test được bỏ qua khi chưa cung cấp SUPPLY_TEST_MONGODB_URI.

Để chứng minh transaction/rollback/concurrency, chạy với replica set thử nghiệm riêng. URI bắt buộc localhost và tên database bắt đầu bằng supply_test; test không đọc .env, không drop database, chỉ dọn fixtures theo companyCode ngẫu nhiên của chính lần test.

```powershell
$env:SUPPLY_TEST_MONGODB_URI = 'mongodb://127.0.0.1:27189/supply_test?replicaSet=supplyTest'
npm run test:supplies
npm run typecheck
npm run build
```

Replica set phải được khởi tạo trước. Có thể chạy mongod riêng với dbpath trong tmp và port chưa dùng; không đổi replica set hoặc dữ liệu của mongod đang phục vụ ứng dụng. Bản test ở lần triển khai này dùng replica set supplyTest, port 27189. Khi xong, dừng đúng process/port thử nghiệm; không dừng toàn bộ tiến trình mongod.

## Khảo sát chỉ đọc

Đặt SUPPLY_INSPECT_MONGODB_URI từ nguồn cấu hình an toàn rồi chạy `npm run inspect:supplies -- --company COMPANY_CODE`.

- Không có fallback .env, không tự thêm user/password vào log.
- autoIndex/autoCreate tắt, không ghi vào collections nghiệp vụ.
- Kiểm tra khả năng transaction bằng hello; đếm và đọc vật tư/giao dịch của đúng công ty.
- Báo cáo JSON ở tmp/supply-inspection, gồm số lượng vấn đề và tối đa 50 ID mẫu mỗi loại.
- Kiểm tra chi nhánh/kho/lô/hạn/giá thiếu, tồn âm hoặc không nguyên, chuỗi lịch sử hở, số dư lệch và giao dịch mồ côi.
- Báo cáo không phải snapshot giao dịch nhất quán khi có người đang nhập/xuất. Khi chuẩn bị cutover, chạy trong cửa sổ đã dừng ghi hoặc trên bản sao nhất quán.
- Không tự sửa số tồn/lô/giá. Chênh lệch tổng nhập/xuất có thể do tồn đầu cũ chưa ghi; cần xác minh.
- Giới hạn snapshot 100.000 vật tư và 1.000.000 giao dịch; vượt ngưỡng cần chuyển công cụ sang stream trước migration.

## API legacy đã thay đổi

- PATCH /supplies/:id từ chối quantity; dùng phiếu nhập/xuất và các luồng điều chỉnh được bổ sung ở bước kế tiếp.
- DELETE /supplies/:id chuyển thành ngừng sử dụng, yêu cầu tồn 0. POST /supplies/:id/restore khôi phục. GET /supplies?archived=true tra cứu danh mục đã ngừng.
- POST tạo vật tư có quantity > 0 đồng thời tạo lịch sử tồn đầu.
- requiresExpiry mặc định true; expiryDate null là chưa xác minh. requiresExpiry=false cần expiryDate trống.
- Client mới gửi Idempotency-Key (8–128 ký tự chữ/số/:/_/-) cho create và nhập/xuất. Key cùng payload trả kết quả cũ; khác payload trả 409.
- Client cũ không có key vẫn được xử lý nguyên tử nhưng chưa chống được yêu cầu gửi lại. Cần nâng cấp caller trước rollout.
- Database standalone hoặc không xác minh được topology trả 503, không ghi một phần.
- Không nhập khác lô/hạn/giá vào vật tư đang còn tồn ở mô hình legacy; tính năng nhiều lô sẽ có trong V2.

## Chuẩn bị phát hành

Tạo/kiểm tra index companyCode+key của SupplyOperation trước khi nhận request có key, cũng như index mã vật tư. Nếu production tắt autoIndex, cần chạy bước tạo index được kiểm tra riêng trong cửa sổ triển khai; không bỏ qua unique index chống trùng.

Không phát hành bằng cách chỉ thay frontend: API, schema và UI cần cùng phiên bản. Giữ bản sao dữ liệu và xác minh topology trước khi mở ghi. Đây chưa phải runbook chuyển dữ liệu sang V2.

## Chuẩn bị index V2

Dùng biến SUPPLY_PROVISION_MONGODB_URI trỏ rõ môi trường đích; script không tự đọc .env. Chạy npm run provision:supply-inventory để kiểm tra chỉ đọc. Sau khi xác minh đúng database, npm run provision:supply-inventory -- --apply chỉ tạo index thiếu; không drop/rebuild index hoặc sửa dữ liệu nghiệp vụ. Script từ chối standalone, index xung đột và dữ liệu trùng khóa. Chạy lại dry-run phải có mọi index ready.

Cấu hình mặc định legacy. Không tự tạo config mode=v2: phải hoàn thành migration/đối soát trước. Khi tạo config lần đầu cần dừng và chờ hết các writer legacy đang chạy. Mọi mutation V2 tương lai (chất lượng, kỳ, kiểm kê, migration) phải dùng cùng khóa config trong transaction.

Giá nguồn hiện tại: tổng giá trị nhận VND do người có quyền khai báo, lưu vào lớp giá; xuất lấy giá theo lớp thực tế được FEFO chọn. Chưa tích hợp công nợ/kế toán.

Outbox chạy sau khi socket khởi tạo, retry tối đa 10 lần; event failed cần được điều tra và khôi phục có kiểm soát sau khi sửa nguyên nhân. Thông báo không chứa giá; socket chỉ gửi eventId để tải lại dữ liệu qua API có scope.

Không chạy đối soát hiện tại trong khi ghi sổ: các truy vấn chỉ đọc chưa dùng chung snapshot. Không sửa trực tiếp balance để xử lý chênh lệch.
