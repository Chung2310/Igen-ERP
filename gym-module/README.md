# Quản lý phòng Gym

Phân hệ này giữ giao diện và nghiệp vụ của [3S-Gym](https://github.com/Chung2310/3S-Gym) tại commit `2bf384aab7e6392348fd9547fd7f353137f1b25f`. Giao diện landing và đăng nhập của 3S không được đưa vào ERP. Không chuyển dữ liệu cũ.

## Tài khoản và quyền

1. Khi tạo doanh nghiệp có bật module `gym`, tài khoản admin của doanh nghiệp cũng là admin GYM. Tài khoản này dùng cùng email và mật khẩu ERP; không cần tạo thêm tài khoản đăng nhập riêng. Nếu bật module sau khi tạo doanh nghiệp, quyền admin GYM có hiệu lực ngay cho chủ doanh nghiệp.
2. Admin GYM vào **Quản lý phòng Gym** và tạo PT trong màn hình quản lý PT sẵn có của 3S. Email và mật khẩu nhập tại đây tạo tài khoản `gym_pt` trong ERP.
3. PT đăng nhập ERP bằng tài khoản vừa tạo, chỉ thấy phân hệ Quản lý phòng Gym và giao diện PT của 3S.
4. Admin GYM hoặc PT cấp tài khoản cho khách tập từ hồ sơ khách có email. Tài khoản `gym_customer` được tạo trong ERP và đăng nhập bằng email, mật khẩu đó; khách chỉ thấy cổng khách của Quản lý phòng Gym. Khi xóa hồ sơ khách, tài khoản ERP liên kết bị vô hiệu hóa.

Hồ sơ và nghiệp vụ PT nằm trong cơ sở dữ liệu riêng của GYM. Tài khoản ERP dùng để đăng nhập, phân quyền và thanh toán Credit; PT không được tạo qua phân hệ nhân sự.

## Credit

Ví Credit ERP là nguồn số dư duy nhất khi chạy GYM trong ERP. Nạp Credit từ màn hình ví GYM gọi API nạp của ERP; tác vụ AI GYM tạm giữ, quyết toán và hoàn Credit qua cầu nối ERP. Lịch sử hiển thị giao dịch ví ERP. Quy đổi nạp hiện tại là 100 VND = 1 Credit. Cấu hình `GYM_ERP_API_URL` trỏ đến API ERP từ backend GYM (Docker dùng `http://igen-erp:3000`). Các API nạp và điều chỉnh ví riêng của 3S bị tắt trong chế độ nhúng.

## Chạy cùng ERP

Đặt `GYM_MONGODB_URI` đến cơ sở dữ liệu MongoDB **riêng** và `GYM_BRIDGE_SECRET` là chuỗi bí mật tối thiểu 32 ký tự trong `.env`. Các biến 3S đã được liệt kê trong `.env.example` với tiền tố `GYM_`, gồm khóa OpenRouter, model AI/OCR, hạn mức AI và Cloudinary. `GYM_OPENROUTER_API_KEY` và `GYM_CLOUDINARY_*` để trống sẽ dùng cấu hình ERP tương ứng. Bật dịch vụ với `docker compose --profile gym up -d`; ERP chuyển tiếp API sang `gym-api` và dùng cùng volume cho ảnh món ăn.

Thanh toán Credit dùng cấu hình PayOS và webhook ví của ERP tại `/api/v1/wallet/webhook`. Đường quay lại sau thanh toán GYM là `/chuoi-gym/wallet`.

Build ERP gọi `npm run build:gym` để biên dịch giao diện vào `dist/chuoi-gym` và backend vào `gym-module/3s/dist/backend`.

## MongoDB local không cần Docker

Từ thư mục ERP, chạy `npm run db:local --prefix gym-module/3s`. Lệnh này tải binary MongoDB khi chạy lần đầu, mở replica set một nút tại `127.0.0.1:27018` và lưu dữ liệu bền vững trong `tmp/gym-mongo` (đã được Git bỏ qua). Giữ cửa sổ lệnh mở khi dùng database; nhấn Ctrl+C để dừng. Lần sau chạy lại cùng lệnh, dữ liệu vẫn còn.

Dùng hai database riêng trên cùng server local:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/igen_erp_dev?replicaSet=gym-local
GYM_MONGODB_URI=mongodb://127.0.0.1:27018/igen_gym_dev?replicaSet=gym-local
```

Lệnh `npm run db:local:check --prefix gym-module/3s -- write` ghi một bản ghi kiểm tra; sau khi khởi động lại MongoDB, chạy `npm run db:local:check --prefix gym-module/3s` để xác nhận dữ liệu còn và xóa bản ghi kiểm tra.

Để chạy backend GYM local trong một cửa sổ PowerShell khác:

```powershell
$env:GYM_EMBEDDED = "1"
$env:MONGODB_URI = "mongodb://127.0.0.1:27018/igen_gym_dev?replicaSet=gym-local"
$env:GYM_BRIDGE_SECRET = "local-only-change-this-32-char-secret"
$env:JWT_SECRET = $env:GYM_BRIDGE_SECRET
$env:PORT = "3018"
npm run start --prefix gym-module/3s
```

Đặt cùng `GYM_BRIDGE_SECRET` và `GYM_BACKEND_URL=http://127.0.0.1:3018` cho ERP local. Nếu thử tính năng AI, thêm `OPENROUTER_API_KEY` trong cửa sổ chạy backend GYM. Giá trị secret minh họa ở trên chỉ dành cho máy local.

Khi các biến `GYM_MONGODB_URI`, `GYM_BRIDGE_SECRET` hợp lệ và `GYM_BACKEND_URL` trỏ tới `localhost:3018`, `npm run dev` sẽ tự khởi chạy API GYM cùng ERP. Nếu chạy `npm run dev:server` riêng, tiếp tục khởi chạy backend GYM thủ công theo lệnh trên.
