# Chuỗi GYM

Phân hệ này giữ giao diện và nghiệp vụ của [3S-Gym](https://github.com/Chung2310/3S-Gym) tại commit `2bf384aab7e6392348fd9547fd7f353137f1b25f`. Giao diện landing và đăng nhập của 3S không được đưa vào ERP. Không chuyển dữ liệu cũ.

## Tài khoản và quyền

1. Superadmin ERP bật module `gym` cho doanh nghiệp và tạo người dùng vai trò `gym_admin` cho chủ GYM.
2. Admin GYM vào **Chuỗi GYM** và tạo PT trong màn hình quản lý PT sẵn có của 3S. Email và mật khẩu nhập tại đây tạo tài khoản `gym_pt` trong ERP.
3. PT đăng nhập ERP bằng tài khoản vừa tạo, chỉ thấy phân hệ Chuỗi GYM và giao diện PT của 3S.

Hồ sơ và nghiệp vụ PT nằm trong cơ sở dữ liệu riêng của GYM. Tài khoản ERP chỉ dùng để đăng nhập và phân quyền; PT không được tạo qua phân hệ nhân sự.

## Chạy cùng ERP

Đặt `GYM_MONGODB_URI` đến cơ sở dữ liệu MongoDB **riêng** và `GYM_BRIDGE_SECRET` là chuỗi bí mật tối thiểu 32 ký tự trong `.env`. Các biến 3S đã được liệt kê trong `.env.example` với tiền tố `GYM_`, gồm khóa OpenRouter, model AI/OCR, hạn mức AI, Cloudinary và thanh toán. `GYM_OPENROUTER_API_KEY` và `GYM_CLOUDINARY_*` để trống sẽ dùng cấu hình ERP tương ứng. Bật dịch vụ với `docker compose --profile gym up -d`; ERP chuyển tiếp API sang `gym-api` và dùng cùng volume cho ảnh món ăn.

Nếu bật thanh toán 3S, cấu hình URL callback ở nhà cung cấp tới `/api/v1/gym/callback/sepay/webhook`, `/payos/webhook`, `/vnpay/ipn`, `/vnpay/return`, hoặc `/momo/ipn` tương ứng. URL đưa người dùng trở lại giao diện là `/chuoi-gym/wallet/payment-result`.

Build ERP gọi `npm run build:gym` để biên dịch giao diện vào `dist/chuoi-gym` và backend vào `gym-module/3s/dist/backend`.
