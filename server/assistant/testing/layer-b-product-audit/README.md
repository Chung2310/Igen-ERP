# Lớp B — kiểm chứng tra cứu sản phẩm bằng fixture

Harness cục bộ, không gọi provider, HTTP hoặc DB thật. Đợt lớp B ban đầu chỉ quan sát; P1 sửa nhãn; P2 thêm prototype C; P3 thêm observer và chạy4 tổ hợp observer/C tắt/bật. Chưa bật production hoặc làm P4.

Chạy từ root repository:

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-b-product-audit/p3-vitest-results.json
node server/assistant/testing/layer-b-product-audit/summarize-p3.mjs
```

- Config chỉ include `*.test.mjs` tại đây, không dùng Vite config ứng dụng, `envDir` là thư mục test để không tự nạp `.env` root. Dùng `forks`: lượt thử `threads` trên máy này có lỗi native lúc shutdown dù assertion đã pass.
- Runtime thật: `processTurn`, catalog, executor/resolver, formatter/completion và `ExecutionBudget`.
- Mock: interpretation scripted, quyền/workflow theo slice, persistence assistant trong bộ nhớ, rewrite và API sản phẩm. Transport mô phỏng các field/search/company/page/limit của API đã đọc; không chạy Mongo hoặc business service thật.
- `safety.setup.mjs` chặn fetch chưa mock, socket/HTTP/TLS/UDP, kết nối và thao tác Mongoose ngoài mock; provider bị thay bằng mock fail. Mọi vi phạm bị ghi lại và kiểm tra sau mỗi case, kể cả khi runtime catch lỗi. Một case cố ý chạm guard để xác minh nó chặn trước I/O; những vi phạm dự kiến được tách riêng, không có request nào được gửi ra ngoài.
- `observations.json` và `vitest-results.json` giữ nguyên bằng chứng baseline14 test trước P1. Không ghi đè hai file này khi tái chạy hồi quy.
- `p1-observations.json` giữ trace sau P1; `p1-vitest-results.json` là kết quả pass/fail chính thức. Thuộc tính `outcome` trong trace chụp ở hook có thể là trạng thái trung gian.
- Đợt P2 xuất `p2-observations.json`, `p2-vitest-results.json` và `p2-comparison.json`, không ghi đè bằng chứng P1/baseline. Có24 cặp tắt/bật,24 test ranh giới bổ sung và1 test so cặp:73 test. Kết quả chính thức lấy từ reporter JSON, không từ trạng thái hook.
- Đợt P3 xuất riêng `p3-observations.json`, `p3-vitest-results.json`, `p3-exact-comparison.json`, `p3-distribution.json` và `p3-observer-overhead.json`. Có161 test:144 lượt ma trận,2 test so cặp và15 test observer/overhead;72 cặp observer tắt/bật không đổi nghiệp vụ. Phân bố chọn cùng19 hội thoại/31 turn mỗi chế độ C, không trộn helper/negative-only controls vào cohort.
- Ca O02 cũ được thay bằng hồi quy chọn đúng mã; thêm pending cũ, option giả, mất quyền và confirmation. F101 so failed legacy với success prototype; read accounting và helper projection ngoài nhánh C vẫn kiểm chứng hiện trạng chưa sửa. Test pass không đồng nghĩa toàn corpus T0.4 đã đạt.
- Metadata timing của Vitest là thời gian chạy mock trên máy này, không là latency Mongo/API/model hoặc SLA production.

Report: [baseline lớp B](../../../../docs/ket-qua-lop-b-tro-ly-erp.md), [P1](../../../../docs/ket-qua-p1-nhan-lua-chon-san-pham.md), [P2](../../../../docs/ket-qua-prototype-c-tro-ly-erp.md) và [P3](../../../../docs/ket-qua-p3-bo-dem-call-tro-ly-erp.md).
