export interface KnowledgeTopicDef {
  val: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  badgeBg: string;
  badgeText: string;
}

export const KNOWLEDGE_TOPICS: KnowledgeTopicDef[] = [
  {
    val: 'DOANH NGHIỆP',
    label: 'Doanh Nghiệp & Thương Hiệu 3S',
    shortLabel: 'Doanh Nghiệp',
    icon: '🏢',
    description: 'Giới thiệu công ty, pháp lý, tầm nhìn, sứ mệnh, ban lãnh đạo & hệ thống chi nhánh',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
  },
  {
    val: 'CHÍNH SÁCH & NỘI QUY',
    label: 'Chính Sách & Nội Quy Phòng Tập',
    shortLabel: 'Chính Sách',
    icon: '📋',
    description: 'Nội quy phòng gym, quy định bảo lưu thẻ, chuyển nhượng, hoàn phí & an toàn tập luyện',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
  },
  {
    val: 'BẢNG GIÁ & DỊCH VỤ',
    label: 'Bảng Giá & Gói Dịch Vụ',
    shortLabel: 'Bảng Giá',
    icon: '💳',
    description: 'Biểu phí gói tập hội viên, gói kèm PT 1-1, dịch vụ F&B, tủ locker & chính sách khuyến mãi',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  {
    val: 'HỆ THỐNG & THIẾT BỊ',
    label: 'Hệ Thống & Thiết Bị Phần Cứng (POS, Cổng soát vé)',
    shortLabel: 'Hệ Thống POS',
    icon: '💻',
    description: 'Máy POS cảm ứng, cổng phân làn Flap Barrier, đầu đọc thẻ RFID, camera AI & máy InBody',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
  },
  {
    val: 'DINH DƯỠNG & THỰC ĐƠN',
    label: 'Dinh Dưỡng & Thư Viện Món Ăn',
    shortLabel: 'Dinh Dưỡng',
    icon: '🥗',
    description: 'Quy chuẩn tính Macro/Calo, thực đơn mẫu món Việt, dinh dưỡng tăng cơ giảm mỡ & dị ứng',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
  },
  {
    val: 'GIÁO ÁN & TẬP LUYỆN',
    label: 'Giáo Án & Kỹ Thuật Bài Tập',
    shortLabel: 'Tập Luyện',
    icon: '🏋️',
    description: 'Kỹ thuật Squat, Bench, Deadlift, phân bổ Volume, RPE/RIR, cues coaching & an toàn khớp',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
  },
  {
    val: 'PHỤC HỒI & MOBILITY',
    label: 'Phục Hồi, Mobility & Giãn Cơ',
    shortLabel: 'Phục Hồi',
    icon: '🧘',
    description: 'Quy trình giãn cơ Static/Dynamic, lăn màng cơ Foam Rolling SMR, độ mở khớp & giấc ngủ',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
  },
  {
    val: 'CHĂM SÓC KHÁCH HÀNG',
    label: 'Quy Trình Chăm Sóc Hội Viên (SOP Care)',
    shortLabel: 'Chăm Sóc',
    icon: '🤝',
    description: 'SOP tiếp nhận học viên mới, theo dõi sau buổi 1, chăm sóc khách nghỉ lâu & xử lý khiếu nại',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
  },
  {
    val: 'TƯ VẤN & BÁN HÀNG',
    label: 'Kịch Bản Tư Vấn & Bán Hàng (Sales Script)',
    shortLabel: 'Tư Vấn Sales',
    icon: '🎯',
    description: 'Tư vấn theo chỉ số InBody, khai thác nỗi đau học viên, xử lý 8 tình huống từ chối phổ biến',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
  },
  {
    val: 'QUY CHUẨN CHUNG',
    label: 'Văn Bản & Quy Chuẩn Khác',
    shortLabel: 'Chung',
    icon: '📜',
    description: 'Tài liệu hành chính, thông báo nội bộ và các văn bản hướng dẫn nghiệp vụ chung',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
  },
];

export function getTopicBadgeStyle(topic: string) {
  const match = KNOWLEDGE_TOPICS.find(
    (t) => t.val.toLowerCase() === topic.toLowerCase() || t.label.toLowerCase().includes(topic.toLowerCase())
  );
  if (match) {
    return { bg: match.badgeBg, text: match.badgeText, icon: match.icon };
  }
  return { bg: 'bg-slate-100', text: 'text-slate-700', icon: '📄' };
}
