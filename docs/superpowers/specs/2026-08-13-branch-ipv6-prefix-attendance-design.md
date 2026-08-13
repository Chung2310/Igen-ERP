# Đối chiếu IPv6 theo mạng khi chấm công

## Mục tiêu

Cho phép nhiều thiết bị dùng cùng một Wi-Fi chấm công khi nhà mạng cấp IPv6 riêng cho từng thiết bị, trong khi vẫn từ chối thiết bị thuộc mạng khác.

## Nguyên nhân

Hệ thống hiện so sánh toàn bộ địa chỉ IP. IPv6 thường dùng phần đầu làm prefix của mạng và phần cuối riêng cho từng thiết bị, nên hai máy trên cùng Wi-Fi có IPv6 khác nhau dù cùng mạng.

## Quy tắc đối chiếu

- IPv4 tiếp tục đối chiếu chính xác toàn bộ địa chỉ.
- IPv6 đối chiếu theo prefix `/64`, là bốn nhóm đầu của địa chỉ IPv6.
- IPv6 lưu dạng đầy đủ từ chi nhánh cũ được tự hiểu là mạng `/64`; không yêu cầu quản trị viên sửa dữ liệu cũ.
- Trường cấu hình chấp nhận cả IPv4, IPv6 đầy đủ và IPv6 CIDR `/64`.
- Khi nút lấy IP nhận được IPv6, giao diện chuyển sang dạng mạng rút gọn, ví dụ `2405:4802:219a:9eb0::/64`.
- Chuỗi IPv6 được chuẩn hóa trước khi đối chiếu để hỗ trợ cả dạng rút gọn và đầy đủ tương đương.

## Bảo mật và phạm vi

Kiểm tra IP vẫn kết hợp với GPS và bán kính chi nhánh. Thay đổi chỉ áp dụng cho cổng chấm công chi nhánh; IPv4 không được nới rộng và các chức năng khác không thay đổi.

## Xử lý lỗi

- IPv4/IPv6/CIDR không hợp lệ bị từ chối khi lưu chi nhánh.
- IPv6 khác prefix `/64` tiếp tục trả lỗi `network_not_allowed`.
- Không thay đổi thông báo lỗi vị trí, mạng hoặc cấu hình chi nhánh hiện tại.

## Kiểm thử

- Hai IPv6 khác phần thiết bị nhưng cùng `/64` được chấp nhận.
- Hai IPv6 khác `/64` bị từ chối.
- IPv6 rút gọn và IPv6 đầy đủ tương đương được nhận diện cùng mạng.
- IPv6 cũ dạng đầy đủ tương thích mà không cần migration.
- IPv4 đúng được chấp nhận và IPv4 khác bị từ chối như hiện tại.
- Validation chi nhánh chấp nhận CIDR IPv6 `/64` và từ chối CIDR/địa chỉ sai.
