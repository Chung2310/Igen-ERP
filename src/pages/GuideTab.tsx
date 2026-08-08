import React, { useState, useMemo } from "react";
import {
  Search,
  BookOpen,
  LayoutDashboard,
  Users,
  Package,
  FolderOpen,
  MessageSquare,
  GraduationCap,
  Settings,
  Shield,
  Info,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Play,
  HelpCircle,
  Clock,
  Send
} from "lucide-react";
import type { TabType } from "../types";

interface GuideStep {
  title: string;
  desc: string;
}

interface GuideSection {
  id: string;
  tabName: TabType;
  subTab?: string;
  title: string;
  shortDesc: string;
  icon: React.ElementType;
  tone: "blue" | "green" | "amber" | "purple" | "rose" | "indigo" | "slate";
  purpose: string;
  steps: GuideStep[];
  protip?: string;
  warning?: string;
}

export default function GuideTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("tong-quan");

  const guideSections: GuideSection[] = [
    {
      id: "tong-quan",
      tabName: "TỔNG QUAN",
      title: "Tổng quan & Báo cáo điều hành",
      shortDesc: "Theo dõi sức khỏe doanh nghiệp qua biểu đồ và gợi ý từ Trợ lý AI.",
      icon: LayoutDashboard,
      tone: "blue",
      purpose: "Giúp bạn có cái nhìn toàn cảnh về tình hình kinh doanh, doanh thu, nhân sự và các cảnh báo khẩn cấp trong ngày mà không cần lục tìm từng thư mục.",
      steps: [
        {
          title: "Xem nhanh số liệu trong ngày",
          desc: "Ngay khi đăng nhập, bạn sẽ thấy các ô thẻ hiển thị tổng doanh thu, số nhân viên đi làm hôm nay, số hàng hóa trong kho và học viên mới. Các con số này được cập nhật liên tục theo thời gian thực."
        },
        {
          title: "Xem phân tích doanh thu chi tiết",
          desc: "Nhấp vào mục 'Phân tích doanh thu' để xem biểu đồ dạng cột. Bạn có thể chọn xem theo Ngày, Tháng, Năm hoặc tự chọn khoảng thời gian cụ thể (ví dụ từ ngày 1 đến ngày 15) bằng công cụ lịch chọn ngày."
        },
        {
          title: "Đọc và xử lý các đề xuất của Trợ lý AI",
          desc: "Ở thanh bên phải, Trợ lý AI sẽ tự động phân tích và đưa ra các cảnh báo (Ví dụ: phát hiện hàng hóa A sắp hết và gợi ý tạo đơn nhập, hoặc gợi ý cách trả lời khách hàng). Bạn có thể bấm trực tiếp vào nút hành động trên thẻ AI để xử lý ngay lập tức."
        }
      ],
      protip: "Hãy kiểm tra phần 'AI Đề xuất' đầu mỗi buổi sáng. Trợ lý ảo sẽ giúp bạn phát hiện những vấn đề tiềm ẩn của doanh nghiệp trước khi chúng phát sinh thành lỗi thực tế.",
      warning: "Số liệu biểu đồ mặc định lấy theo múi giờ Việt Nam. Nếu bạn chọn khoảng thời gian tùy chỉnh, hãy đảm bảo ngày bắt đầu phải trước ngày kết thúc."
    },
    {
      id: "nhan-su",
      tabName: "NHÂN SỰ",
      title: "Quản lý Nhân sự & Phân chia Công việc",
      shortDesc: "Quản lý hồ sơ nhân viên, vẽ sơ đồ công ty, bảng công việc kéo thả và chấm công.",
      icon: Users,
      tone: "green",
      purpose: "Giúp phòng nhân sự quản lý thông tin nhân viên, sơ đồ tổ chức, theo dõi lịch chấm công hằng ngày và quản lý tiến độ công việc một cách trực quan bằng bảng kéo thả.",
      steps: [
        {
          title: "Xem và thêm hồ sơ nhân viên mới",
          desc: "Vào danh sách nhân viên, bấm nút 'Thêm mới', điền đầy đủ các thông tin như Họ tên, Số điện thoại, Email, chức vụ và người quản lý trực tiếp. Hệ thống sẽ tự động gửi email kích hoạt tài khoản cho nhân viên."
        },
        {
          title: "Xem sơ đồ cây tổ chức công ty",
          desc: "Hệ thống sẽ tự động kết nối thông tin 'Người quản lý trực tiếp' của từng nhân viên để vẽ ra một sơ đồ dạng cây trực quan. Bạn có thể nhìn rõ ai đang báo cáo cho ai và cấu trúc từng phòng ban."
        },
        {
          title: "Theo dõi chấm công hàng ngày",
          desc: "Hệ thống hiển thị danh sách nhân viên đã đi làm hôm nay, giờ đến cụ thể, những ai đi muộn (chữ màu cam) và những người chưa check-in để người quản lý dễ dàng nắm bắt quân số."
        },
        {
          title: "Giao việc và cập nhật tiến độ công việc (Kéo thả)",
          desc: "Trong bảng công việc, bạn có thể tạo các thẻ nhiệm vụ mới, mô tả công việc bằng tiếng Việt dễ hiểu và chọn người thực hiện. Khi nhân viên làm việc, họ có thể kéo thẻ này từ cột 'Chưa làm' sang 'Đang làm' hoặc 'Đã xong' để mọi người cùng theo dõi."
        },
        {
          title: "Đăng tải tài liệu đào tạo nội bộ",
          desc: "Tạo các bài giảng hướng dẫn công việc hoặc video quy trình cho nhân viên mới tự học. Bạn có thể theo dõi tiến độ học tập (ví dụ nhân viên A đã hoàn thành 80% khóa đào tạo hội nhập)."
        }
      ],
      protip: "Khi sử dụng bảng kéo thả công việc, hãy khuyến khích nhân viên cập nhật thẻ ngay khi bắt đầu làm và khi hoàn thành để toàn đội luôn nắm được tiến độ dự án mà không cần họp báo cáo nhiều.",
      warning: "Để vẽ sơ đồ tổ chức chính xác, hãy nhớ chọn đúng thông tin 'Người quản lý' khi thêm hoặc sửa hồ sơ của mỗi nhân viên."
    },
    {
      id: "kho-san-pham",
      tabName: "KHO & SẢN PHẨM",
      title: "Quản lý Kho hàng & Sản phẩm",
      shortDesc: "Quản lý danh sách hàng hóa, mã phân loại riêng, xuất nhập kho và đề xuất nhập hàng tự động.",
      icon: Package,
      tone: "amber",
      purpose: "Giúp thủ kho và nhân viên bán hàng theo dõi số lượng tồn kho chính xác, quản lý xuất nhập và nhận cảnh báo tự động khi hàng hóa sắp hết.",
      steps: [
        {
          title: "Khai báo sản phẩm mới và đặt mã phân loại riêng",
          desc: "Mỗi sản phẩm khi đưa lên hệ thống cần có mã riêng biệt để không bị nhầm lẫn (ví dụ: Áo thun đỏ cỡ M là AT-DO-M). Hãy điền tên sản phẩm, giá bán, giá nhập và ngưỡng tồn kho tối thiểu cần báo động."
        },
        {
          title: "Tạo phiếu Nhập kho",
          desc: "Khi nhập hàng mới từ nhà cung cấp về, hãy tạo Phiếu Nhập Kho, chọn sản phẩm, điền số lượng nhập thực tế và giá nhập. Số lượng tồn kho trên hệ thống sẽ tự động cộng thêm tương ứng."
        },
        {
          title: "Tạo phiếu Xuất kho",
          desc: "Khi bán hàng hoặc chuyển hàng đi, hãy tạo Phiếu Xuất Kho. Sau khi hoàn thành phiếu, số lượng tồn kho trên hệ thống sẽ tự động trừ đi và ghi nhận vào báo cáo doanh thu."
        },
        {
          title: "Theo dõi cảnh báo tồn kho và tạo đề xuất nhanh",
          desc: "Nếu sản phẩm nào có số lượng tồn kho thấp hơn mức tối thiểu quy định, hệ thống sẽ đổi sang màu đỏ. Bạn chỉ cần click vào nút đề xuất nhập kho bên cạnh, Trợ lý AI sẽ tự soạn thảo một đơn hàng mẫu để gửi duyệt."
        }
      ],
      protip: "Đặt mã phân loại sản phẩm có quy luật (Ví dụ: viết tắt tên sản phẩm - màu sắc - kích thước) sẽ giúp nhân viên kho tìm kiếm và đóng gói hàng nhanh gấp đôi, tránh hoàn toàn việc giao nhầm kích cỡ hay màu sắc.",
      warning: "Luôn kiểm tra kỹ số lượng thực tế trước khi bấm xác nhận 'Hoàn thành' phiếu nhập/xuất kho, vì sau khi xác nhận, số lượng tồn kho sẽ thay đổi trực tiếp và không thể tự ý sửa đổi nếu không có quyền của người quản lý cấp cao."
    },
    {
      id: "quan-ly-tai-nguyen",
      tabName: "QUẢN LÝ TÀI NGUYÊN",
      title: "Quản lý Tài liệu & Đồng bộ Google Drive",
      shortDesc: "Lưu trữ quy trình nội bộ và liên kết xem file từ Google Drive cá nhân.",
      icon: FolderOpen,
      tone: "indigo",
      purpose: "Giúp tập hợp tất cả tài liệu, quy trình làm việc, hợp đồng mẫu của công ty vào một nơi an toàn để nhân viên dễ dàng tìm kiếm và làm việc.",
      steps: [
        {
          title: "Tìm kiếm tài liệu dùng chung",
          desc: "Vào mục Tài nguyên, bạn sẽ thấy các thư mục được chia theo chủ đề (Ví dụ: Quy định công ty, Mẫu hợp đồng, Hướng dẫn nghiệp vụ). Bạn có thể gõ từ khóa vào ô tìm kiếm để lọc nhanh file cần dùng."
        },
        {
          title: "Tải lên tài liệu mới",
          desc: "Nếu bạn có quyền, bạn có thể tạo thư mục mới hoặc tải file trực tiếp từ máy tính lên. Hãy đặt tên file rõ ràng, dễ hiểu và chọn đúng thư mục lưu trữ."
        },
        {
          title: "Liên kết với Google Drive cá nhân",
          desc: "Bấm vào nút 'Kết nối Google Drive', làm theo hướng dẫn đăng nhập tài khoản Google công việc của bạn. Sau khi liên kết thành công, bạn có thể duyệt tìm và mở các file Drive cá nhân của mình trực tiếp ngay trong giao diện ERP."
        }
      ],
      protip: "Thay vì tải file hợp đồng hay quy trình về máy rồi gửi cho đồng nghiệp qua chat, bạn chỉ cần copy link của file đó trong mục Tài nguyên gửi cho đồng nghiệp để đảm bảo mọi người luôn dùng chung một bản cập nhật mới nhất.",
      warning: "Khi tải lên tài liệu nội bộ nhạy cảm, hãy chú ý chọn đúng phân quyền xem (cho cả công ty hay chỉ dành riêng cho cấp quản lý)."
    },
    {
      id: "tro-chuyen",
      tabName: "TRÒ CHUYỆN",
      title: "Trò chuyện & Nhắn tin nội bộ",
      shortDesc: "Nhắn tin riêng 1-1, lập nhóm thảo luận công việc và nhắc tên đồng nghiệp.",
      icon: MessageSquare,
      tone: "purple",
      purpose: "Hệ thống nhắn tin nội bộ tức thời giúp kết nối tất cả thành viên trong công ty để trao đổi công việc nhanh chóng, an toàn và bảo mật, thay thế cho các ứng dụng cá nhân ngoài.",
      steps: [
        {
          title: "Bắt đầu cuộc trò chuyện 1-1",
          desc: "Nhấp vào thanh tìm kiếm trong mục Trò chuyện, gõ tên đồng nghiệp bạn muốn nhắn tin. Click vào tên họ để mở khung chat riêng tư."
        },
        {
          title: "Tạo phòng chat nhóm",
          desc: "Bấm vào biểu tượng dấu cộng (+) cạnh danh sách phòng chat, đặt tên nhóm (ví dụ: 'Dự án Sự kiện 2026') và tích chọn các thành viên muốn thêm vào nhóm, sau đó bấm tạo."
        },
        {
          title: "Nhắc tên đồng nghiệp để nhận thông báo khẩn",
          desc: "Trong lúc nhắn tin, gõ ký hiệu `@` kèm tên đồng nghiệp (ví dụ: `@Nguyen Van A`). Người được nhắc tên sẽ nhận được thông báo rung chuông ngay lập tức trên thiết bị của họ để vào phản hồi công việc."
        },
        {
          title: "Gửi tệp đính kèm và hình ảnh",
          desc: "Bấm vào biểu tượng ghim giấy trong khung chat để chọn và gửi tài liệu hoặc ảnh chụp công việc trực tiếp cho đồng nghiệp."
        }
      ],
      protip: "Sử dụng tính năng nhắc tên `@all` trong phòng chat nhóm khi bạn muốn thông báo một tin tức cực kỳ quan trọng ảnh hưởng đến toàn bộ thành viên trong nhóm.",
      warning: "Nội dung tin nhắn trò chuyện được lưu trữ phục vụ công việc của doanh nghiệp, hãy giao tiếp lịch sự, chuyên nghiệp và tránh chia sẻ các thông tin cá nhân ngoài công việc."
    },
    {
      id: "quan-ly-hoc-vien",
      tabName: "QUẢN LÝ HỌC VIÊN",
      title: "Quản lý Học viên & Đào tạo Trung tâm",
      shortDesc: "Quản lý hồ sơ học viên, lịch học, lịch thi, công nợ học phí, QR check-in và gửi email tự động.",
      icon: GraduationCap,
      tone: "blue",
      purpose: "Phân hệ cốt lõi cho các trung tâm đào tạo, giúp quản lý toàn bộ vòng đời của học viên từ lúc tuyển sinh, xếp lớp, thi cử, đóng học phí cho đến khi tốt nghiệp.",
      steps: [
        {
          title: "Đăng ký học viên mới và Xếp lớp",
          desc: "Vào tab HỌC VIÊN, chọn 'Thêm học viên', nhập thông tin cá nhân. Tại đây bạn có thể chọn khóa học và xếp lớp học phù hợp cho học viên đó."
        },
        {
          title: "Chuyển cơ sở/trung tâm học tập",
          desc: "Nếu học viên muốn chuyển sang cơ sở học khác, click vào hồ sơ học viên, chọn 'Chuyển cơ sở', chọn địa điểm mới và xác nhận. Toàn bộ thông tin học tập và học phí của học viên sẽ được chuyển giao tự động."
        },
        {
          title: "Quản lý Lịch thi & Kết quả",
          desc: "Tại tab LỊCH THI, bạn có thể tạo ca thi mới, phân phòng thi và cập nhật điểm số sau khi có kết quả thi của học viên."
        },
        {
          title: "Xem và Theo dõi Học phí & Công nợ",
          desc: "Tab HỌC PHÍ sẽ liệt kê danh sách học viên cùng trạng thái đóng học phí. Bạn sẽ biết ngay học viên nào đã hoàn thành, ai còn nợ bao nhiêu để tiến hành gửi nhắc nhở."
        },
        {
          title: "Điểm danh nhanh bằng mã QR (QR Check-in)",
          desc: "Mỗi buổi học, giảng viên chỉ cần trình chiếu hoặc in mã QR của lớp học đó. Học viên sử dụng điện thoại quét mã QR này để điểm danh tự động. Hệ thống sẽ ngay lập tức ghi nhận trạng thái đi học của học viên vào sổ điểm danh điện tử."
        },
        {
          title: "Gửi Email tự động cho Giáo viên & Trợ giảng",
          desc: "Khi có lịch dạy mới, lịch thi mới hoặc có thay đổi thời gian lớp học, hệ thống sẽ tự động soạn và gửi email thông báo chi tiết đến hộp thư cá nhân của giảng viên phụ trách mà bạn không cần viết email thủ công."
        }
      ],
      protip: "Sử dụng QR Check-in giúp tiết kiệm 10-15 phút đầu giờ của mỗi lớp học và tránh hoàn toàn tình trạng điểm danh hộ hay ghi chép sai lệch bằng giấy tờ.",
      warning: "Để tính năng gửi email tự động cho giảng viên hoạt động chính xác, hãy đảm bảo email trong hồ sơ của Giảng viên đã được nhập đúng định dạng và không bị viết sai chính tả."
    },
    {
      id: "cai-dat",
      tabName: "CÀI ĐẶT",
      title: "Cài đặt cá nhân & Cấu hình hòm thư điện tử",
      shortDesc: "Đổi ảnh đại diện, đổi mật khẩu cá nhân và kết nối hòm thư gửi thông báo tự động.",
      icon: Settings,
      tone: "slate",
      purpose: "Nơi thiết lập hồ sơ cá nhân và kết nối tài khoản thư điện tử để hệ thống tự động gửi tin nhắn, cũng như điều chỉnh trợ lý AI.",
      steps: [
        {
          title: "Chỉnh sửa hồ sơ cá nhân",
          desc: "Trong phần 'Hồ sơ cá nhân', bạn có thể thay đổi tên hiển thị, cập nhật số điện thoại và tải lên ảnh đại diện mới của mình."
        },
        {
          title: "Thay đổi mật khẩu tài khoản",
          desc: "Chuyển sang mục 'Bảo mật', nhập mật khẩu cũ và nhập mật khẩu mới hai lần để đảm bảo an toàn, tránh người lạ đăng nhập."
        },
        {
          title: "Cài đặt tài khoản gửi email thông báo tự động của công ty",
          desc: "Nếu là Quản trị viên, bạn vào phần 'Cấu hình hệ thống' -> cài đặt hòm thư gửi thư tự động. Hãy điền địa chỉ email của công ty, mật khẩu kết nối của hòm thư đó. Sau khi cài đặt xong, tất cả thư thông báo học phí hay lịch học sẽ được gửi tự động từ chính địa chỉ email này của công ty."
        },
        {
          title: "Điều chỉnh Trợ lý ảo trí tuệ nhân tạo (AI)",
          desc: "Bạn có thể chọn bật hoặc tắt sự hỗ trợ của Trợ lý ảo AI trên hệ thống, điều chỉnh cách nói chuyện của AI cho phù hợp với văn hóa của công ty."
        }
      ],
      protip: "Khi kết nối hòm thư gửi email tự động bằng Gmail, bạn cần bật tính năng bảo mật 2 lớp của tài khoản Gmail đó và tạo một 'Mật khẩu ứng dụng' riêng biệt, chứ không dùng mật khẩu Gmail thông thường đăng nhập hằng ngày để đảm bảo hòm thư không bị khóa.",
      warning: "Không bao giờ chia sẻ tài khoản đăng nhập hòm thư chung gửi tự động của công ty cho người không có phận sự để tránh nguy cơ lộ lọt thông tin khách hàng."
    },
    {
      id: "quan-tri-user",
      tabName: "QUẢN TRỊ USER",
      title: "Quản trị người dùng & Phân chia quyền hạn",
      shortDesc: "Cấp tài khoản cho nhân viên mới, phân quyền truy cập và cài đặt hệ thống video tự động.",
      icon: Shield,
      tone: "indigo",
      purpose: "Phân hệ cao cấp nhất dành riêng cho Quản trị viên để bảo mật hệ thống, quản lý danh sách tài khoản của nhân viên và thiết lập các kết nối kỹ thuật nâng cao.",
      steps: [
        {
          title: "Cấp tài khoản cho nhân viên mới",
          desc: "Bấm 'Tạo tài khoản mới', nhập email đăng ký của nhân viên, mật khẩu khởi tạo mặc định và thiết lập vị trí/vai trò làm việc ban đầu cho họ."
        },
        {
          title: "Phân quyền truy cập theo công việc",
          desc: "Bạn có thể chỉ định quyền hạn: Quản trị tối cao (toàn quyền hệ thống), Quản trị viên (quản lý phân hệ), Trưởng bộ phận hoặc Nhân viên bình thường. Nhân viên chỉ nhìn thấy các chức năng cần thiết cho công việc của họ để bảo mật thông tin nội bộ công ty."
        },
        {
          title: "Cài đặt kết nối hệ thống tạo video tự động (HeyGen)",
          desc: "Để sử dụng tính năng tự động tạo video giới thiệu bằng người ảo thuyết trình phục vụ quảng cáo, hãy nhập mã bảo mật kết nối vào mục cấu hình tương ứng và bấm lưu lại."
        }
      ],
      protip: "Hãy áp dụng nguyên tắc phân quyền tối thiểu: Nhân viên làm bộ phận nào thì chỉ cấp quyền truy cập vào đúng khu vực đó (Ví dụ: thủ kho chỉ cần quyền vào mục 'KHO & SẢN PHẨM'). Điều này giúp màn hình làm việc gọn gàng và tránh bấm nhầm dữ liệu của nhau.",
      warning: "Tài khoản Quản trị tối cao có thể thay đổi và xóa mọi dữ liệu trên hệ thống. Hãy cân nhắc cực kỳ kỹ trước khi cấp quyền này cho bất kỳ thành viên nào."
    }
  ];

  const handleQuickRedirect = (tab: TabType, subTab?: string) => {
    const pathMap: Record<string, string> = {
      "TỔNG QUAN": "/tong-quan",
      "NHÂN SỰ": "/nhan-su",
      "KHO & SẢN PHẨM": "/kho-san-pham",
      "QUẢN TRỊ USER": "/quan-tri-user",
      "CÀI ĐẶT": "/cai-dat",
      "QUẢN LÝ HỌC VIÊN": "/quan-ly-hoc-vien",
      "TRÒ CHUYỆN": "/tro-chuyen",
      "QUẢN LÝ TÀI NGUYÊN": "/quan-ly-tai-nguyen",
    };
    let path = pathMap[tab];
    if (path) {
      if (subTab) {
        path += `?sub=${subTab}`;
      }
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return guideSections;
    const query = searchQuery.toLowerCase().trim();
    return guideSections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.shortDesc.toLowerCase().includes(query) ||
        section.purpose.toLowerCase().includes(query) ||
        section.steps.some(
          (step) =>
            step.title.toLowerCase().includes(query) ||
            step.desc.toLowerCase().includes(query)
        )
    );
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return guideSections.find((s) => s.id === selectedId) || guideSections[0];
  }, [selectedId]);

  const toneStyles: Record<string, { bg: string; text: string; border: string; activeBg: string; hoverBg: string }> = {
    blue: {
      bg: "bg-blue-50/50",
      text: "text-blue-700",
      border: "border-blue-100",
      activeBg: "bg-blue-50 border-blue-200 text-blue-800",
      hoverBg: "hover:bg-blue-50/30"
    },
    green: {
      bg: "bg-emerald-50/50",
      text: "text-emerald-700",
      border: "border-emerald-100",
      activeBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
      hoverBg: "hover:bg-emerald-50/30"
    },
    amber: {
      bg: "bg-amber-50/50",
      text: "text-amber-700",
      border: "border-amber-100",
      activeBg: "bg-amber-50 border-amber-200 text-amber-800",
      hoverBg: "hover:bg-amber-50/30"
    },
    purple: {
      bg: "bg-purple-50/50",
      text: "text-purple-700",
      border: "border-purple-100",
      activeBg: "bg-purple-50 border-purple-200 text-purple-800",
      hoverBg: "hover:bg-purple-50/30"
    },
    rose: {
      bg: "bg-rose-50/50",
      text: "text-rose-700",
      border: "border-rose-100",
      activeBg: "bg-rose-50 border-rose-200 text-rose-800",
      hoverBg: "hover:bg-rose-50/30"
    },
    indigo: {
      bg: "bg-indigo-50/50",
      text: "text-indigo-700",
      border: "border-indigo-100",
      activeBg: "bg-indigo-50 border-indigo-200 text-indigo-800",
      hoverBg: "hover:bg-indigo-50/30"
    },
    slate: {
      bg: "bg-slate-50/50",
      text: "text-slate-700",
      border: "border-slate-100",
      activeBg: "bg-slate-100 border-slate-350 text-slate-900",
      hoverBg: "hover:bg-slate-50/30"
    }
  };

  return (
    <div className="h-full flex flex-col font-sans overflow-hidden bg-[#fafbfe]" id="guide_tab_container">
      {/* Premium Glassmorphic Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Cẩm nang Hướng dẫn Sử dụng iGen ERP
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Tài liệu hướng dẫn thao tác từng bước bằng ngôn ngữ đơn giản, dễ hiểu cho mọi nhân viên.
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Tìm hướng dẫn nhanh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/80 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-xs"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Main Body Layout Split */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {/* Left sidebar: modules index list */}
        <div className="w-80 shrink-0 bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs overflow-y-auto hidden md:flex">
          <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
            Danh sách phân hệ ({filteredSections.length})
          </p>
          <div className="flex flex-col gap-1">
            {filteredSections.map((section) => {
              const isSelected = selectedId === section.id;
              const Icon = section.icon;
              const style = toneStyles[section.tone];

              return (
                <button
                  key={section.id}
                  onClick={() => setSelectedId(section.id)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl border text-left transition-all ${
                    isSelected ? style.activeBg + " shadow-xs font-semibold" : `border-transparent text-gray-600 ${style.hoverBg}`
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-white" : style.bg} ${style.text}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs truncate ${isSelected ? "text-gray-900" : "text-gray-800"}`}>
                      {section.title.split(" & ")[0]}
                    </p>
                    <p className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-gray-500" : "text-gray-400"}`}>
                      Tab {section.tabName}
                    </p>
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-gray-500" : "text-gray-300"}`} />
                </button>
              );
            })}
            {filteredSections.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                Không tìm thấy bài viết nào
              </div>
            )}
          </div>
        </div>

        {/* Right side: Active module guide details */}
        <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl shadow-xs overflow-y-auto flex flex-col min-w-0">
          {/* Mobile view top select navigation helper */}
          <div className="p-4 border-b border-gray-150 md:hidden bg-slate-50 shrink-0">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Chọn phân hệ cần xem:
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-9 px-3 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 bg-white"
            >
              {guideSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.title}
                </option>
              ))}
            </select>
          </div>

          <div className="p-6 md:p-8 flex-1 space-y-6">
            {/* Header info inside card */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${toneStyles[activeSection.tone].bg} ${toneStyles[activeSection.tone].text}`}>
                  {React.createElement(activeSection.icon, { className: "h-6 w-6" })}
                </div>
                <div>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border tracking-wider ${toneStyles[activeSection.tone].bg} ${toneStyles[activeSection.tone].border} ${toneStyles[activeSection.tone].text}`}>
                    Phân hệ: {activeSection.tabName}
                  </span>
                  <h2 className="text-lg font-bold text-gray-800 mt-1">{activeSection.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">{activeSection.shortDesc}</p>
                </div>
              </div>

              {/* Redirect Action Button */}
              <button
                onClick={() => handleQuickRedirect(activeSection.tabName, activeSection.subTab)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 cursor-pointer self-start sm:self-center shrink-0"
              >
                Mở ứng dụng ngay
                <Play className="h-3 w-3 fill-white" />
              </button>
            </div>

            {/* Purpose explanation block */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0" />
                Công dụng & Ý nghĩa
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {activeSection.purpose}
              </p>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                Hướng dẫn các thao tác từng bước
              </h3>
              
              <div className="relative border-l border-emerald-100 ml-3.5 pl-6 space-y-6 py-1">
                {activeSection.steps.map((step, idx) => (
                  <div key={idx} className="relative group">
                    {/* Circle timeline index */}
                    <div className="absolute -left-[35px] top-0 h-6.5 w-6.5 rounded-full border border-white bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 leading-normal">{step.title}</h4>
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protip & Warning Alert Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {activeSection.protip && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex gap-3">
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800">Mẹo nhỏ sử dụng (Pro-tip):</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{activeSection.protip}</p>
                  </div>
                </div>
              )}
              {activeSection.warning && (
                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800">Lưu ý quan trọng:</h4>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">{activeSection.warning}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Guide Help Desk banner */}
            <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h4 className="text-xs font-bold text-gray-800">Bạn vẫn chưa thực hiện được thao tác?</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Hãy gửi câu hỏi cho Trợ lý ảo AI của hệ thống ở góc màn hình bên phải để được trợ giúp tức thì.
                </p>
              </div>
              <button
                onClick={() => handleQuickRedirect("TRÒ CHUYỆN")}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                Nhắn tin hỗ trợ nội bộ
                <Send className="h-3 w-3" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
