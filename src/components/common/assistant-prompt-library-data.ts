export interface AssistantPromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  owner: "igen" | "user";
}

export const assistantPromptCategories = [
  "Tất cả",
  "Marketing",
  "Kinh doanh",
  "Tài chính",
  "Nhân sự",
  "Hành chính công",
  "Công nghệ thông tin",
  "Giáo dục",
] as const;

export const starterAssistantPromptTemplates: AssistantPromptTemplate[] = [
  {
    "id": "igen-marketing-competitor-analysis",
    "title": "Phân tích 3 đối thủ cạnh tranh",
    "description": "So sánh sản phẩm, điểm mạnh, giá và hoạt động marketing gần đây.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia phân tích thị trường. Hãy lập báo cáo chi tiết so sánh ba đối thủ cạnh tranh chính của [sản phẩm/công ty].\n\nTrình bày bảng theo các tiêu chí:\n- Sản phẩm chủ lực: mô tả sản phẩm hoặc dịch vụ nổi bật nhất của từng đối thủ.\n- Điểm mạnh/điểm yếu: phân tích ưu điểm, hạn chế và tác động đến khách hàng.\n- Chiến lược giá: mức giá, gói ưu đãi và khuyến mãi nếu có.\n- Hoạt động marketing nổi bật trong sáu tháng gần nhất: chiến dịch quảng cáo, sự kiện hoặc hoạt động truyền thông đáng chú ý.\n\nSau bảng, nhận xét vị thế cạnh tranh của [sản phẩm/công ty]. Với thông tin gần đây, ghi nguồn và ngày kiểm tra. Nêu rõ dữ liệu chưa xác minh hoặc còn thiếu; không tự tạo số liệu hay sự kiện.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-customer-persona",
    "title": "Xây dựng chân dung khách hàng",
    "description": "Lập Customer Persona theo nhu cầu, mục tiêu và hành vi truyền thông.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia nghiên cứu khách hàng. Hãy xây dựng Customer Persona hoàn chỉnh cho [sản phẩm/dịch vụ], gồm:\n1. Nhân khẩu học: tuổi, giới tính, nghề nghiệp, thu nhập, học vấn, nơi sinh sống và tình trạng gia đình.\n2. Nỗi đau (Pain Points): thách thức, khó khăn hoặc nhu cầu chưa được đáp ứng.\n3. Mục tiêu (Goals): mục tiêu ngắn hạn và dài hạn khi sử dụng sản phẩm/dịch vụ.\n4. Động lực mua hàng: lý do chọn sản phẩm/dịch vụ này thay vì lựa chọn cạnh tranh.\n5. Kênh truyền thông thường dùng: nền tảng số, phương tiện truyền thống và nguồn tin đáng tin cậy như Facebook, LinkedIn, YouTube hoặc báo chí.\n\nDựa trên dữ liệu được cung cấp hoặc kịch bản hợp lý với ngành và thị trường mục tiêu. Phân biệt dữ liệu thực tế với giả định; nêu thông tin cần nghiên cứu thêm thay vì trình bày giả định như sự thật.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-kpi-plan",
    "title": "Lập bảng KPI Marketing",
    "description": "Đề xuất chỉ số đo hiệu quả theo từng hạng mục marketing.",
    "category": "Marketing",
    "prompt": "Bạn là trưởng phòng Marketing. Hãy lập bảng KPI đo hiệu quả kế hoạch marketing cho [sản phẩm/dịch vụ] trong [thời gian], hướng đến [đối tượng khách hàng] và mục tiêu [mục tiêu].\n\nChia theo hạng mục phù hợp như quảng cáo, nội dung, mạng xã hội, PR, email, sự kiện và chuyển đổi bán hàng. Mỗi dòng gồm: hạng mục, mục tiêu, KPI, cách tính/đơn vị đo, nguồn dữ liệu, tần suất theo dõi và hành động khi kết quả thấp.\n\nChỉ chọn KPI liên quan trực tiếp đến mục tiêu. Nếu thiếu ngân sách, dữ liệu nền hoặc mục tiêu kinh doanh, nêu thông tin còn thiếu và không tự đặt chỉ tiêu số thiếu căn cứ.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-customer-journey",
    "title": "Lập bản đồ hành trình khách hàng",
    "description": "Mô tả hành động, cảm xúc và điểm chạm từ nhận biết đến trung thành.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia trải nghiệm khách hàng (CX). Hãy tạo bản đồ hành trình mua và sử dụng [sản phẩm/dịch vụ] dưới dạng bảng với các cột:\n- Giai đoạn: Nhận biết, Cân nhắc, Mua hàng, Trung thành.\n- Hành động của khách hàng: việc cụ thể khách hàng thực hiện ở từng giai đoạn.\n- Cảm xúc: cảm xúc hoặc trạng thái tâm lý phổ biến tại từng điểm.\n- Điểm chạm với thương hiệu: kênh, nền tảng hoặc tương tác ở giai đoạn đó.\n\nSắp xếp mạch lạc từ lần đầu biết đến sản phẩm/dịch vụ đến khi trở thành khách hàng trung thành. Dùng thông tin về phân khúc hoặc kênh bán nếu có; nếu chưa có, ghi rõ giả định.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-launch-campaign",
    "title": "Đề xuất chiến dịch ra mắt",
    "description": "Phát triển ba ý tưởng chiến dịch online và offline cho sản phẩm mới.",
    "category": "Marketing",
    "prompt": "Bạn là giám đốc sáng tạo. Hãy đề xuất ba ý tưởng chiến dịch marketing để ra mắt [sản phẩm/sự kiện], hướng đến người dùng 18–35 tuổi yêu công nghệ, năng động và hiện đại.\n\nVới mỗi ý tưởng, trình bày:\n- Tên chiến dịch: ngắn gọn, dễ nhớ, thể hiện tinh thần hoặc lợi ích nổi bật.\n- Thông điệp chủ đạo (Key Message): rõ ràng, truyền cảm hứng, nhấn mạnh điểm khác biệt đã được cung cấp.\n- Hoạt động online: mạng xã hội, YouTube, influencer marketing, quảng cáo trả phí, website hoặc email.\n- Hoạt động offline: sự kiện ra mắt, activation tại điểm bán, triển lãm, roadshow hoặc hợp tác đối tác.\n\nĐiều chỉnh theo thông tin thực tế. Nếu là tai nghe, chỉ nêu tính năng và lợi ích đã xác nhận; không tự tạo thông số hoặc cam kết.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-social-posts",
    "title": "Lên ý tưởng bài đăng Fanpage",
    "description": "Tạo năm ý tưởng bài đăng đa dạng để quảng bá sản phẩm hoặc dịch vụ.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia nội dung mạng xã hội. Hãy đề xuất năm ý tưởng bài đăng Fanpage quảng bá [sản phẩm/dịch vụ] đến [đối tượng theo dõi].\n\nMỗi ý tưởng gồm:\n- Định dạng: Ảnh, Video hoặc Carousel.\n- Tiêu đề: ngắn gọn, thu hút và khuyến khích tương tác.\n- Nội dung chính: truyền tải lợi ích hoặc giá trị phù hợp với người theo dõi.\n- CTA: hướng dẫn hành động cụ thể như nhắn tin, đặt hàng, bình luận hoặc chia sẻ.\n\nĐảm bảo các ý tưởng có góc tiếp cận đa dạng, phù hợp với cách sử dụng mạng xã hội hiện nay. Không tự thêm giá, ưu đãi hoặc tính năng chưa được cung cấp.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-short-video",
    "title": "Viết kịch bản TikTok / Reels",
    "description": "Soạn kịch bản video ngắn 30–45 giây với hình, tiếng và lời thoại.",
    "category": "Marketing",
    "prompt": "Bạn là nhà sáng tạo nội dung video chuyên nghiệp. Hãy viết kịch bản TikTok hoặc Reels dài 30–45 giây về [sản phẩm/dịch vụ], phù hợp với [đối tượng mục tiêu].\n\nChia thành ba phần, bảo đảm tổng thời lượng đúng 30–45 giây:\n1. Mở đầu gây tò mò (5–10 giây): thu hút bằng câu hỏi, hình ảnh bất ngờ hoặc thông điệp ấn tượng.\n2. Nội dung chính (20–30 giây): truyền tải thông điệp/giới thiệu sản phẩm bằng hình ảnh, lời thoại/narration và chữ trên màn hình.\n3. CTA (5–10 giây): hướng người xem bình luận, theo dõi, nhấp liên kết hoặc chia sẻ.\n\nVới mỗi phần, mô tả thời lượng, hình ảnh, âm thanh, lời thoại và text trên màn hình. Giữ nhịp nhanh, súc tích; chỉ dùng thông tin sản phẩm đã được cung cấp.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-email",
    "title": "Soạn email Marketing",
    "description": "Viết email hoàn chỉnh để thông báo chương trình ưu đãi hoặc sự kiện.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia email marketing. Hãy soạn email hoàn chỉnh thông báo về [chương trình khuyến mãi hoặc sự kiện].\n\nEmail cần có:\n1. Tiêu đề hấp dẫn, nêu lợi ích/thông điệp chính; thêm preheader nếu phù hợp.\n2. Nội dung cá nhân hóa theo [nhóm khách hàng] khi cần.\n3. CTA nổi bật như đăng ký, nhận ưu đãi hoặc tham dự sự kiện.\n4. Cấu trúc chuyên nghiệp: lời chào, thông tin chính, lý do hành động sớm nếu có và chữ ký thương hiệu.\n\nGiữ đúng tone of voice [tone of voice] và mục tiêu [mục tiêu marketing]. Chỉ nêu thời hạn, điều kiện ưu đãi và quyền lợi đã được cung cấp; không tự tạo thông tin chương trình.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-facebook-ads",
    "title": "Viết 3 mẫu quảng cáo Facebook Ads",
    "description": "Tạo ba mẫu quảng cáo khác góc tiếp cận để thúc đẩy chuyển đổi.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia quảng cáo kỹ thuật số. Hãy viết ba mẫu Facebook Ads quảng bá [sản phẩm/dịch vụ] đến [đối tượng mục tiêu].\n\nMỗi mẫu gồm:\n- Primary Text: thông điệp hấp dẫn, thuyết phục và nêu lợi ích phù hợp.\n- Headline: ngắn gọn, tạo chú ý và khuyến khích tìm hiểu.\n- Description: thông tin bổ sung hỗ trợ nội dung chính và tiêu đề.\n\nTạo ba mẫu khác nhau về góc tiếp cận nhưng cùng hướng đến [mục tiêu chuyển đổi]. Dùng thông tin nhân khẩu học, tâm lý và hành vi đã được cung cấp; không tự bịa tính năng, giá, ưu đãi hoặc kết quả.",
    "owner": "igen"
  }
];

export const initialAssistantPromptFavorites = [
  "igen-marketing-competitor-analysis",
  "igen-marketing-customer-persona",
  "igen-marketing-kpi-plan",
  "igen-marketing-customer-journey"
];
