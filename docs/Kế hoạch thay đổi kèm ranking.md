# Kế hoạch nâng cấp QLHV

## Mục tiêu

Hoàn thiện trên base QLHV hiện có các luồng: điểm danh QR, chất lượng học viên, tiến độ lớp, thi cử, bảo lưu/học lại và chuyển lớp theo lộ trình.

## Nguyên tắc triển khai

- Tên lớp không được thay đổi sau khi tạo.
- Lịch sử lớp, điểm danh, điểm và trạng thái cũ của học viên luôn được giữ lại.
- Gộp lớp là tạo một lớp đích mới và xếp học viên từ nhiều lớp nguồn vào đó; không đổi lớp HSK1 cũ thành lớp HSK2.

## Thời gian hoàn thiện

**Mục tiêu hoàn thiện trong 3 ngày làm việc. Ngày thứ 4 chỉ là thời gian dự phòng** cho lỗi dữ liệu cũ, lỗi phát hiện khi nghiệm thu hoặc thay đổi nghiệp vụ phát sinh.

## Độ ưu tiên

| Thứ tự | Mức | Hạng mục | Lý do |
| :---- | :---- | :---- | :---- |
| 1 | P0.1 | QR điểm danh nhớ học viên | Ưu tiên cao nhất: giảm thao tác và tạo dữ liệu chuyên cần chính xác |
| 2 | P0.2 | Tab Chất lượng học viên | Ưu tiên cao nhất: tập trung chuyên cần, bài tập, thái độ và điểm |
| 3 | P0.3 | Quản lý lớp, sĩ số, số buổi và cảnh báo thời gian | Nhu cầu vận hành hàng ngày của giáo viên/điều phối |
| 4 | P1 | Thi, mini test, bảo lưu, học lại và hồ sơ học viên | Hoàn thiện đánh giá và các trường hợp ngoại lệ |
| 5 | P2 | Lộ trình, danh sách chờ và gộp lớp | Cần dữ liệu P0/P1 ổn định để xếp lớp chính xác |

## Xếp hạng độ khó kỹ thuật

Xếp hạng này độc lập với độ ưu tiên nghiệp vụ. Hạng 1 là khó nhất, cần được rà kỹ luồng dữ liệu, phân quyền và kiểm thử trước khi mở rộng các chức năng phụ thuộc.

| Hạng khó | Hạng mục | Mức độ | Lý do |
| :---- | :---- | :---- | :---- |
| 1 | QR điểm danh nhớ học viên | Rất cao | Cần xác thực phiên QR theo buổi, nhận diện thiết bị an toàn, không lưu số điện thoại thô trên trình duyệt, chống điểm danh trùng/quét hộ, xử lý đổi thiết bị và cập nhật điểm danh thời gian thực. |
| 2 | Tab Chất lượng học viên | Rất cao | Phải tổng hợp chính xác chuyên cần, bài tập, thái độ, mini test và điểm thi từ nhiều nguồn dữ liệu; cần bộ lọc, cảnh báo và liên kết ngược tới lớp, điểm danh, lịch thi và hồ sơ. |
| 3 | Lộ trình, danh sách chờ và gộp lớp | Cao | Cần bảo toàn lịch sử học, kiểm tra điều kiện lên lớp và sĩ số, ngăn xếp trùng, đồng thời tạo đăng ký mới ở lớp đích thay vì thay đổi lớp nguồn. |
| 4 | Bảo lưu, học lại và trạng thái học viên | Cao | Cần quản lý số buổi còn lại, số lần học lại và lệ phí, chuyển trạng thái đúng quy tắc và loại trừ học viên học lại khỏi danh sách lên lớp. |
| 5 | Lịch thi, mini test và điểm số | Trung bình \- cao | Phải liên kết lớp với danh sách dự thi, đồng bộ kết quả sang Chất lượng/hồ sơ và lưu vết người sửa điểm, thời điểm sửa, lý do sửa. |
| 6 | Quản lý lớp, sĩ số và cảnh báo | Trung bình | Cần khóa tên lớp, kiểm tra sức chứa, tính chính xác 4 buổi còn lại theo lịch, cảnh báo quá hạn và nhãn tuổi lớp độc lập. |
| 7 | Hồ sơ học viên | Trung bình | Chủ yếu là tổng hợp và hiển thị lịch sử lớp, số buổi, số khóa, điểm và đánh giá từ các dữ liệu đã chuẩn hóa ở các hạng mục trên. |

## Kế hoạch thực hiện trong 3 ngày

| Ngày | Công việc | Kết quả bàn giao |
| :---- | :---- | :---- |
| Ngày 1 | **P0.2 \+ P0.3:** hoàn thiện dữ liệu đăng ký học viên-lớp, tab Chất lượng, cảnh báo tiến độ theo buổi, sĩ số và khóa tên lớp | Giáo viên theo dõi chất lượng ở một nơi; lớp cảnh báo đúng tiến độ; dữ liệu lớp và buổi học ổn định cho các luồng sau |
| Ngày 2 | **P1 \+ P2:** lịch thi/mini test, bảo lưu, học lại, hồ sơ, cấu hình điều kiện lên lớp, danh sách chờ và gộp lớp | Xử lý được ngoại lệ, điểm được đồng bộ, chuyển lớp không mất lịch sử |
| Ngày 3 | **P0.1 — QR điểm danh \+ nghiệm thu:** QR theo buổi, nhập số điện thoại lần đầu, lưu mã nhận diện thiết bị, chống trùng và kiểm thử toàn luồng | Học viên nhập đúng số điện thoại một lần; những lần sau quét QR là nhận diện và điểm danh; bản sẵn sàng nghiệm thu |

QR được thực hiện ngày 3 vì đây là hạng mục khó nhất và phụ thuộc vào dữ liệu lớp, học viên, buổi học và số buổi được phép đã ổn định từ ngày 1-2. Ngày 4 dự phòng ưu tiên cho lỗi QR, dữ liệu cũ hoặc lỗi phát hiện khi nghiệm thu.

### Thời gian dự phòng

- **Ngày 4 không mặc định tính vào thời gian phát triển.**
- Chỉ sử dụng khi dữ liệu cũ không tương thích, có lỗi phát hiện trong nghiệm thu hoặc trung tâm thay đổi quy tắc đã chốt.
- Nếu không có vấn đề phát sinh, bàn giao chính thức vào cuối ngày 3\.

---

## Module 1 — QR điểm danh nhớ học viên

**Ưu tiên:** P0.1
**Thực hiện:** Ngày 3

### Luồng sử dụng

1. Giáo viên mở điểm danh cho một buổi học.
2. Hệ thống tạo QR dành riêng cho đúng lớp và buổi đó.
3. Lần đầu quét, học viên nhập đúng số điện thoại đã có trong hệ thống.
4. Hệ thống xác định học viên, điểm danh và lưu mã nhận diện an toàn trên thiết bị.
5. Những buổi sau, học viên chỉ cần quét QR; hệ thống tự nhận diện và điểm danh.
6. Màn hình hiển thị tên học viên, lớp, buổi và thời gian điểm danh thành công.

### Chức năng quản trị

- Giáo viên xem danh sách điểm danh theo thời gian thực.
- Giáo viên có thể điểm danh hoặc sửa trạng thái thủ công.
- Không tạo hai bản ghi điểm danh cho một học viên trong cùng một buổi.
- Có nút “Đổi học viên” khi dùng chung thiết bị hoặc nhận diện sai.
- QR hết hạn, sai lớp hoặc số điện thoại không thuộc lớp phải báo rõ lý do.

### Ràng buộc kỹ thuật

- Không lưu số điện thoại dạng thô trong trình duyệt; chỉ lưu mã nhận diện thiết bị.
- QR hết hạn khi giáo viên đóng điểm danh để hạn chế quét hộ.
- Khi đổi máy, xóa dữ liệu trình duyệt hoặc dùng ẩn danh, học viên nhập lại số điện thoại một lần.

### Tiêu chí hoàn thành

- Cùng một thiết bị chỉ nhập số điện thoại ở lần đầu.
- Những lần sau quét QR là nhận diện đúng học viên và điểm danh ngay.
- Giáo viên vẫn xử lý được ngoại lệ bằng điểm danh thủ công.

---

## Module 2 — Tab Chất lượng học viên

**Ưu tiên:** P0.2
**Thực hiện:** Ngày 1

### Mục tiêu

Tạo một tab chung để giáo viên và điều phối không phải theo dõi rời rạc ở chat, lớp học và ghi chú riêng.

### Chức năng thay đổi

- Lọc theo lớp, trình độ, giáo viên, trạng thái học và mức cảnh báo.
- Hiển thị số buổi có mặt/tổng số buổi và tỷ lệ chuyên cần.
- Hiển thị số bài tập đã làm/tổng số bài tập và mức hoàn thiện bài tập.
- Nhập ghi chú thái độ của từng học viên.
- Hiển thị điểm mini test, điểm thi mới nhất và đánh giá tổng hợp.
- Liên kết nhanh sang lớp học, điểm danh, lịch thi và hồ sơ học viên.

### Tiêu chí hoàn thành

- Điều phối lọc được ngay học viên ít tham gia hoặc ít làm bài tập.
- Giáo viên có nơi chính thức để ghi nhận thái độ và đánh giá chất lượng.

---

## Module 3 — Quản lý lớp học và cảnh báo thời gian

**Ưu tiên:** P0.3
**Thực hiện:** Ngày 1

### Chức năng thay đổi

- Hiển thị trên thẻ lớp: tên lớp, trình độ, giáo viên, lịch học, sĩ số hiện tại/sức chứa và số buổi đã học/tổng số buổi.
- Dùng **chỉ báo tiến độ vận hành** làm màu chính của thẻ lớp: lớp đang học bình thường hiển thị màu xanh; lớp chỉ còn tối đa 4 buổi theo lịch hiển thị màu vàng; lớp quá ngày kết thúc nhưng chưa hoàn thành hiển thị màu đỏ.
- Dùng **chỉ báo tuổi lớp sau hoàn thành** là nhãn phụ, độc lập với màu tiến độ vận hành: hoàn thành từ 6 tháng đến 1 năm hiển thị vàng; quá 1 năm hiển thị đỏ. Nhãn này giúp quản lý nhận biết lớp cũ để rà soát dữ liệu, không thay thế trạng thái vận hành của lớp.
- Tên lớp không được chỉnh sửa sau khi tạo.
- Cho phép thêm/bớt học viên nhưng không xóa lịch sử học của lớp cũ.
- Mỗi đăng ký học của học viên phải lưu tổng số buổi được học, số buổi đã học và số buổi còn lại; không cho ghi nhận điểm danh vượt số buổi được phép. Bảo lưu phải giữ nguyên số buổi còn lại.
- Hiển thị cảnh báo tiến độ vận hành của lớp:

| Màu | Điều kiện | Ý nghĩa |
| :---- | :---- | :---- |
| Xanh | Lớp đang học, còn trên 4 buổi theo lịch và chưa quá ngày kết thúc | Lớp còn trong tiến độ bình thường |
| Vàng | Lớp đang học, còn tối đa 4 buổi theo lịch và chưa quá ngày kết thúc | Giáo viên cần theo dõi để hoàn thành lớp đúng hạn |
| Đỏ | Đã qua ngày kết thúc nhưng lớp chưa được hoàn thành | Cần xử lý hoặc hoàn thành lớp trước khi tiếp tục vận hành |
| Xám | Chưa khai giảng, đã hoàn thành hoặc đã hủy | Không áp dụng cảnh báo |

Số buổi đã học/tổng số buổi luôn hiển thị để theo dõi tiến độ. Số buổi còn lại được tính từ các buổi hợp lệ theo lịch chưa diễn ra; màu vàng không tính theo số ngày. Nếu lớp đã quá ngày kết thúc, màu đỏ có ưu tiên cao hơn màu vàng.

Nhãn phụ về tuổi lớp chỉ hiển thị khi lớp đã hoàn thành:

| Màu nhãn | Điều kiện | Ý nghĩa |
| :---- | :---- | :---- |
| Trung tính | Hoàn thành dưới 6 tháng | Lớp mới hoàn thành |
| Vàng | Hoàn thành từ 6 tháng đến 1 năm | Cần lưu ý khi rà soát dữ liệu lớp cũ |
| Đỏ | Hoàn thành quá 1 năm | Lớp đã cũ, cần ưu tiên rà soát/lưu trữ dữ liệu theo quy trình trung tâm |

### Tiêu chí hoàn thành

- Quản lý biết ngay lớp nào còn tối đa 4 buổi hoặc đã quá hạn.
- Giáo viên thấy rõ cảnh báo vàng/đỏ của lớp mình phụ trách.
- Việc thêm/bớt học viên có kiểm tra sức chứa, số buổi được phép và không mất lịch sử.
- Quản lý thấy nhãn phụ để nhận biết lớp đã hoàn thành từ 6 tháng đến 1 năm hoặc quá 1 năm.

### Ghi chú triển khai

- Khi triển khai, chạy `yarn backfill:batch-enrollments` một lần để khởi tạo đăng ký còn thiếu cho toàn bộ học viên ở lớp cũ; script idempotent nên có thể chạy lại an toàn. Khi mở sổ buổi hoặc lưu điểm danh, hệ thống vẫn tự khởi tạo phần dữ liệu cũ còn thiếu. Số buổi được học lấy theo lịch lớp hợp lệ và số buổi đã học được đếm lại từ lịch sử điểm danh.
- Bảo lưu lưu lý do, ngày bảo lưu và ngày dự kiến quay lại; học viên bảo lưu không thể được điểm danh có mặt/đi muộn. Khi tiếp tục học, hệ thống chỉ đổi trạng thái và giữ nguyên tổng buổi, buổi đã học và buổi còn lại.
- Thẻ và bảng lớp hiển thị đồng thời số buổi đã học/tổng số buổi cùng số buổi còn lại để theo dõi tiến độ.

---

## Module 4 — Lịch thi, mini test và điểm số

**Ưu tiên:** P1
**Thực hiện:** Ngày 2

### Chức năng thay đổi

- Lịch thi liên kết trực tiếp với lớp học.
- Lập danh sách học viên dự thi từ lớp và cho phép điều chỉnh từng học viên.
- Nhập điểm thi, mini test và nhận xét.
- Đồng bộ điểm vào tab Chất lượng và hồ sơ học viên.
- Cho phép sửa điểm, có lưu người sửa, thời điểm và lý do.

### Tiêu chí hoàn thành

- Giáo viên nhập điểm một lần; điểm hiển thị đúng trong hồ sơ học viên.
- Kết quả là dữ liệu đầu vào để xét điều kiện lên lớp tiếp theo.

---

## Module 5 — Bảo lưu, học lại và trạng thái học viên

**Ưu tiên:** P1
**Thực hiện:** Ngày 2

### Bảo lưu

- Lưu ngày bắt đầu bảo lưu, lý do, số buổi còn lại và ngày dự kiến quay lại.
- Không trừ số buổi trong thời gian bảo lưu.
- Khi quay lại, điều phối xếp học viên vào lớp phù hợp nhưng vẫn giữ lịch sử lớp cũ.

### Học lại

- Học viên được học lại miễn phí một lần.
- Từ lần học lại thứ hai, admin nhập lệ phí cần thu.
- Lưu số lần học lại, lớp học lại, lý do, admin nhập lệ phí, số tiền và thời điểm nhập để đối soát.
- Học viên đang học lại không được đưa nhầm vào danh sách lên lớp.

### Trạng thái cần có

- Đang học.
- Bảo lưu.
- Học lại.
- Hoàn thành khóa.
- Chờ xếp lớp tiếp theo.
- Không còn nhu cầu học.

“Hoàn thành khóa” và “Không còn nhu cầu học” là hai trạng thái tách biệt.

---

## Module 6 — Hồ sơ học viên

**Ưu tiên:** P1
**Thực hiện:** Ngày 2

### Chức năng thay đổi

- Hiển thị các lớp đã học và lộ trình học.
- Hiển thị tổng số buổi đã học, tổng số khóa đã học.
- Hiển thị điểm thi, mini test, chuyên cần và đánh giá chất lượng.
- Lọc học viên đã hoàn thành hoặc không còn nhu cầu để điều phối xử lý dữ liệu vận hành mà không xóa lịch sử.

---

## Module 7 — Lộ trình, danh sách chờ và gộp lớp

**Ưu tiên:** P2
**Thực hiện:** Ngày 2

### Quy tắc lộ trình

- Trung tâm tự cấu hình từng mốc của khóa/lộ trình, ví dụ: HSK1 → HSK2 → HSK3.
- Trung tâm tự cấu hình điều kiện lên lớp ở từng mốc: điểm tối thiểu, chuyên cần, hoàn thành bài tập, giáo viên xác nhận hoặc kết hợp các điều kiện này.
- Người dùng tự cấu hình sĩ số tối thiểu và tối đa của lớp.

### Luồng gộp lớp

Ví dụ: HSK1-A có 30 học viên, trong đó 20 người đạt điều kiện và muốn học tiếp HSK2. Hệ thống đưa 20 người vào danh sách chờ HSK2. Khi có thêm học viên phù hợp từ HSK1-B hoặc HSK1-C, điều phối chọn học viên để tạo HSK2-A mới hoặc xếp vào lớp HSK2 chưa khai giảng.

### Chức năng thay đổi

- Sau khi hoàn tất/chấm lớp, ghi nhận nhu cầu của từng học viên: học tiếp, chưa xác nhận, không tiếp tục, bảo lưu hoặc học lại.
- Đưa học viên đủ điều kiện và muốn học tiếp vào danh sách chờ trình độ kế tiếp.
- Lọc danh sách chờ theo trình độ, cơ sở, hình thức học, khung giờ và số ngày chờ.
- Chọn nhiều học viên để tạo lớp mới hoặc xếp vào lớp chưa khai giảng.
- Kiểm tra sĩ số cấu hình và không cho xếp trùng học viên trong cùng lộ trình.
- Hiển thị nhãn “Đã học qua” tại các trình độ đã hoàn thành.

### Giới hạn trong phạm vi 3 ngày

- Điều phối chọn học viên để gộp/xếp lớp bằng tay, có hỗ trợ lọc và kiểm tra điều kiện.
- Không tự tối ưu lịch học, giáo viên hoặc gộp lớp bằng thuật toán phức tạp.
- Mỗi lần lên lớp tạo một đăng ký ở lớp đích mới; không thay đổi lớp nguồn.

### Tiêu chí hoàn thành

- Tạo được HSK2 từ học viên của nhiều lớp HSK1.
- Hồ sơ thể hiện được lộ trình, ví dụ: HSK1-A → HSK2-C → HSK3-B.
- Lịch sử HSK1, điểm danh và điểm thi không bị thay đổi sau khi lên HSK2.

---

## Nghiệm thu cuối đợt

- Kiểm tra luồng: tạo lớp → mở buổi → QR điểm danh → đánh giá chất lượng → nhập điểm → bảo lưu/học lại hoặc lên lớp tiếp theo.
- Kiểm tra phân quyền giáo viên, điều phối và admin.
- Kiểm tra dữ liệu trùng: điểm danh trùng, xếp lớp trùng, số buổi âm, điểm danh vượt số buổi được phép và vượt sức chứa.
- Hướng dẫn ngắn cho giáo viên sử dụng QR/đánh giá và điều phối xử lý bảo lưu/gộp lớp.

## Quy tắc nghiệp vụ đã chốt

| Nội dung | Quy tắc áp dụng |
| :---- | :---- |
| Cảnh báo vàng tiến độ | Lớp đang học và còn tối đa 4 buổi theo lịch; nếu đã quá ngày kết thúc thì ưu tiên cảnh báo đỏ |
| Cảnh báo đỏ | Đã qua ngày kết thúc nhưng lớp chưa được hoàn thành |
| Nhãn tuổi lớp vàng | Lớp đã hoàn thành từ 6 tháng đến 1 năm; là nhãn phụ, độc lập với màu tiến độ |
| Nhãn tuổi lớp đỏ | Lớp đã hoàn thành quá 1 năm; là nhãn phụ, độc lập với màu tiến độ |
| Giới hạn số buổi học viên | Không được điểm danh vượt tổng số buổi được phép; bảo lưu giữ nguyên số buổi còn lại |
| Học lại | Miễn phí một lần; từ lần thứ hai admin nhập lệ phí |
| Điều kiện lên lớp | Từng trung tâm tự cấu hình tại từng mốc của khóa/lộ trình |
| Sĩ số lớp | Người dùng tự cấu hình sĩ số tối thiểu và tối đa |
| QR lần đầu | Học viên nhập đúng số điện thoại đã có trong hệ thống |
| QR các lần sau | Hệ thống tự nhận diện học viên theo thiết bị đã ghi nhớ |
| Ưu tiên cao nhất | QR điểm danh và tab Chất lượng học viên |
