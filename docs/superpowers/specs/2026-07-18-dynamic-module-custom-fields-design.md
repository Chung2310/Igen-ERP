# Thiết kế trường dữ liệu động cho các module

## 1. Mục tiêu

Cho phép người có quyền tạo trường dữ liệu mới ngay trong các form có chức năng **Thêm** mà không phải sửa model, validation hoặc giao diện bằng mã nguồn cho từng trường. Trường mới áp dụng cho toàn bộ bản ghi thuộc cùng công ty và cùng module.

Ví dụ: khi Admin thêm trường ảnh trong form Thêm học viên, trường ảnh xuất hiện trên tất cả học viên. Các học viên cũ có giá trị trống; học viên mới có thể nhập giá trị ngay trong form hiện tại.

## 2. Phạm vi

- Áp dụng tại sáu form tạo bản ghi chính: Thêm học viên, Thêm khóa học mới, Mở lớp mới, Tạo đợt thi, Khai báo tài nguyên mới và Khai báo đối tác mới.
- Nút **+ Thêm trường** nằm bên trong form tạo mới của từng module.
- Không xây dựng màn hình quản lý trường động trong trang Cài đặt.
- Cấu hình trường hiện có được chỉnh sửa trực tiếp tại form tạo mới.
- Các trường nghiệp vụ cố định hiện tại tiếp tục sử dụng schema hiện có. Chỉ các trường do người dùng tạo mới được lưu dưới dạng trường động.

## 3. Quyền truy cập

Chỉ các vai trò sau được phép tạo hoặc thay đổi cấu hình trường:

- Super Admin
- Admin
- Leader

Các vai trò còn lại chỉ được xem và nhập giá trị cho trường được phép hiển thị. Server phải kiểm tra quyền cho mọi API cấu hình; việc ẩn nút trên giao diện không được xem là biện pháp bảo mật đầy đủ.

## 4. Mô hình dữ liệu

### 4.1. Định nghĩa trường

Mỗi trường động có một bản ghi `FieldDefinition` với tối thiểu các thuộc tính:

```ts
interface FieldDefinition {
  id: string;
  tenantId: string;
  moduleKey: string;
  key: string;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
  isVisible: boolean;
  isRequired: boolean;
  isArchived: boolean;
  order: number;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}
```

`tenantId` bảo đảm trường được áp dụng cho toàn bộ người dùng trong cùng công ty nhưng không rò rỉ sang công ty khác. Cặp `tenantId + moduleKey + key` phải duy nhất. `key` ổn định sau khi tạo; đổi nhãn hiển thị không làm thay đổi nơi lưu dữ liệu.

### 4.2. Giá trị trên bản ghi

Mỗi model nghiệp vụ có vùng `customFields` để lưu giá trị theo khóa trường:

```json
{
  "customFields": {
    "studentPhoto": {
      "url": "https://example.invalid/file.jpg",
      "fileName": "file.jpg"
    }
  }
}
```

Không cập nhật toàn bộ document cũ khi tạo trường. Trường không tồn tại trong `customFields` được hiểu là giá trị trống. Cách này tránh migration hàng loạt và cho phép trường mới có hiệu lực ngay.

## 5. Loại trường được hỗ trợ

Hệ thống trường động hỗ trợ đầy đủ các nhóm thông dụng:

- Văn bản ngắn, văn bản dài, email, điện thoại và đường dẫn.
- Số, phần trăm và tiền tệ.
- Ngày, giờ và ngày giờ.
- Chọn một, chọn nhiều, checkbox và công tắc.
- Tệp đính kèm, một ảnh và nhiều ảnh.

Mỗi loại trường có cấu hình validation tương ứng. Trường lựa chọn yêu cầu danh sách `options`; trường tệp và ảnh có giới hạn định dạng, dung lượng và số lượng.

## 6. Trải nghiệm người dùng

### 6.1. Tạo trường

Trong mọi form tạo mới, người có quyền nhìn thấy nút **+ Thêm trường** ở cuối danh sách trường. Hộp cấu hình trường gồm:

- Tên trường.
- Loại dữ liệu.
- Nội dung gợi ý.
- Giá trị mặc định, nếu có.
- Bắt buộc nhập.
- Cho phép hiển thị.
- Các lựa chọn hoặc giới hạn tệp tùy loại trường.

Sau khi lưu định nghĩa, trường xuất hiện ngay trong form đang mở mà không làm mất dữ liệu người dùng đã nhập. Trường cũng có hiệu lực trên form Thêm, form Sửa và phần Chi tiết của mọi bản ghi trong cùng module.

### 6.2. Chỉnh sửa trường

Trường động có thao tác cấu hình dành riêng cho Super Admin, Admin và Leader ngay trong form tạo mới. Người có quyền có thể:

- Đổi tên hiển thị, placeholder và giá trị mặc định.
- Bật hoặc tắt hiển thị.
- Bật hoặc tắt bắt buộc.
- Đổi thứ tự trường.
- Lưu trữ trường.

Tắt hiển thị hoặc lưu trữ không xóa giá trị đã nhập. Không cho đổi kiểu dữ liệu nếu dữ liệu hiện có không thể chuyển đổi an toàn. Không xóa cứng trường đã có dữ liệu.

## 7. Luồng dữ liệu

1. Khi mở form, giao diện tải các `FieldDefinition` đang hoạt động theo `tenantId` và `moduleKey`.
2. Giao diện kết hợp trường cố định với trường động theo `order` để dựng form.
3. Khi tạo hoặc sửa bản ghi, giá trị động được gửi trong `customFields`.
4. Server tải lại định nghĩa trường từ nguồn tin cậy, kiểm tra quyền và validation, sau đó chỉ chấp nhận các khóa thuộc module hiện tại.
5. Khi xem chi tiết, giao diện ghép định nghĩa trường với giá trị; khóa chưa có giá trị được hiển thị là trống.
6. Sau khi cấu hình trường thay đổi, cache liên quan đến tenant và module phải bị vô hiệu hóa để các phiên đang dùng nhận cấu hình mới.

## 8. Quy tắc bắt buộc và dữ liệu cũ

- Bản ghi mới phải đáp ứng tất cả trường đang hiển thị và được đánh dấu bắt buộc.
- Bản ghi cũ không bị coi là lỗi ngay khi một trường bắt buộc mới được tạo.
- Khi người dùng mở bản ghi cũ trong form Sửa và bấm Lưu, server yêu cầu bổ sung mọi trường bắt buộc còn thiếu.
- Việc chỉ xem bản ghi, tìm kiếm hoặc thực hiện tác vụ không lưu bản ghi không kích hoạt yêu cầu bổ sung.
- Nếu trường bắt buộc đang bị ẩn hoặc lưu trữ, hệ thống không yêu cầu nhập trường đó. Giao diện không được cho phép cấu hình trạng thái vừa ẩn vừa bắt buộc có hiệu lực.

## 9. API và phân tách trách nhiệm

- Dịch vụ định nghĩa trường chịu trách nhiệm tạo, đọc, sửa, sắp xếp và lưu trữ `FieldDefinition`.
- Bộ dựng form phía giao diện chỉ chịu trách nhiệm hiển thị định nghĩa và thu thập giá trị.
- Bộ validation phía server chuyển `FieldDefinition` thành quy tắc kiểm tra dữ liệu và là nguồn quyết định cuối cùng.
- Dịch vụ upload tiếp tục quản lý tệp; `customFields` chỉ lưu metadata và tham chiếu tệp, không lưu nội dung nhị phân.
- API cấu hình và API ghi bản ghi phải xác định `tenantId` từ phiên đăng nhập, không nhận tenant tùy ý từ client.

## 10. Xử lý lỗi và an toàn dữ liệu

- Nếu tạo trường thất bại, form tạo bản ghi giữ nguyên toàn bộ dữ liệu đã nhập.
- Nếu upload thất bại, hiển thị lỗi tại đúng trường và cho phép thử lại.
- Nếu hai người đồng thời tạo cùng một `key`, ràng buộc duy nhất phía database từ chối bản ghi sau và API trả thông báo dễ hiểu.
- API từ chối khóa không được định nghĩa, sai module hoặc sai tenant để ngăn chèn dữ liệu tùy ý.
- Thay đổi cấu hình trường phải được ghi nhận người tạo/người sửa và thời điểm thay đổi.
- Lưu trữ trường là thao tác có thể phục hồi; dữ liệu trên các bản ghi không bị xóa.

## 11. Kiểm thử chấp nhận

- Super Admin, Admin và Leader tạo/chỉnh sửa trường thành công; vai trò khác bị từ chối ở cả UI và API.
- Tạo trường tại một module không làm trường xuất hiện ở module khác hoặc tenant khác.
- Trường mới xuất hiện ngay trong form đang mở và trên toàn bộ form Thêm, Sửa, Chi tiết liên quan.
- Bản ghi cũ hiển thị trường mới với giá trị trống mà không cần migration document.
- Trường bắt buộc mới không làm hỏng luồng xem bản ghi cũ nhưng chặn lưu khi form Sửa chưa được bổ sung.
- Mọi loại trường được kiểm tra đúng ở giao diện và server, bao gồm lựa chọn, số, ngày, tệp và ảnh.
- Tắt hiển thị hoặc lưu trữ trường không làm mất dữ liệu; khôi phục trường trả lại giá trị cũ.
- Thao tác đồng thời, trùng khóa, upload lỗi và dữ liệu sai kiểu trả lỗi rõ ràng mà không mất dữ liệu đang nhập.

## 12. Ngoài phạm vi

- Không tạo màn hình quản trị trường động riêng trong trang Cài đặt.
- Không tự động chuyển toàn bộ trường cố định hiện tại sang `customFields`.
- Không xóa cứng dữ liệu trường động đã được sử dụng.
- Không chạy migration hàng loạt để chèn khóa rỗng vào mọi bản ghi cũ.
- Không áp dụng cho các form hành động phụ hoặc module ngoài sáu điểm đã chốt, bao gồm Học phí, Thông báo, thêm học viên vào đợt thi, mức hoa hồng, khoản chi trả và danh mục.
