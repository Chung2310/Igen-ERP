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
  },
  {
    "id": "igen-marketing-7day-social-calendar",
    "title": "Lập kế hoạch nội dung 7 ngày",
    "description": "Xây lịch đăng bài theo ngày, giờ, định dạng và mục tiêu.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia quản lý mạng xã hội. Hãy lập kế hoạch nội dung chi tiết cho [kênh social] với [sản phẩm/dịch vụ] trong bảy ngày tới.\n\nTrình bày dưới dạng bảng với các cột:\n- Ngày.\n- Giờ đăng.\n- Chủ đề.\n- Loại nội dung: hình ảnh, video, bài viết hoặc infographic.\n- Mục tiêu cụ thể: tăng tương tác, quảng bá sản phẩm, giáo dục khách hàng hoặc mục tiêu phù hợp khác.\n\nĐảm bảo nội dung phù hợp với đối tượng mục tiêu, định hướng thương hiệu của kênh và mang lại giá trị rõ rệt cho người theo dõi. Phân bổ chủ đề và định dạng đa dạng trong tuần. Dùng múi giờ được cung cấp; nếu chưa có, ghi rõ giả định. Không tự thêm thông tin sản phẩm hoặc ưu đãi chưa được xác nhận.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-creative-brief",
    "title": "Soạn creative brief",
    "description": "Chuẩn bị brief sáng tạo rõ mục tiêu, insight, thông điệp và yêu cầu.",
    "category": "Marketing",
    "prompt": "Bạn là Account Manager. Hãy soạn creative brief đầy đủ và chuyên nghiệp cho [sản phẩm/dịch vụ].\n\nBrief cần gồm:\n1. Bối cảnh dự án: lý do tổ chức chiến dịch, tình hình thị trường, xu hướng liên quan và vấn đề cần giải quyết.\n2. Mục tiêu chiến dịch: mục tiêu cụ thể, đo lường được như tăng nhận diện, thúc đẩy doanh số hoặc thay đổi nhận thức.\n3. Đối tượng mục tiêu và insight: nhân khẩu học, hành vi, nhu cầu và insight liên quan đến sản phẩm/dịch vụ.\n4. Thông điệp cốt lõi: ngắn gọn, ấn tượng, truyền cảm hứng và phản ánh đúng giá trị sản phẩm cũng như insight.\n5. Yêu cầu bắt buộc (Mandatories): logo, slogan, thông tin pháp lý, giới hạn nội dung, kênh triển khai và quy định từ thương hiệu/khách hàng.\n\nTrình bày logic, rõ ràng và có thể triển khai trên các nền tảng truyền thông. Phân biệt dữ liệu với giả định; đánh dấu thông tin còn thiếu thay vì tự tạo quy định, ngân sách hoặc mục tiêu số.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-aida-landing-page",
    "title": "Viết nội dung landing page theo AIDA",
    "description": "Soạn landing page tập trung lợi ích và chuyển đổi đăng ký hoặc mua hàng.",
    "category": "Marketing",
    "prompt": "Bạn là copywriter chuyên nghiệp. Hãy viết toàn bộ nội dung landing page giới thiệu [sản phẩm/dịch vụ], áp dụng cấu trúc AIDA (Attention, Interest, Desire, Action) với mục tiêu thuyết phục người đọc [đăng ký/mua hàng].\n\nTổ chức nội dung theo bốn phần:\n- Attention: tiêu đề và phần mở đầu thu hút đúng đối tượng.\n- Interest: thông tin giúp người đọc hiểu sản phẩm/dịch vụ và cách giải quyết nhu cầu của họ.\n- Desire: lợi ích thiết thực, điểm khác biệt đã xác nhận và bằng chứng đáng tin cậy nếu được cung cấp.\n- Action: lời kêu gọi hành động rõ ràng, mạnh mẽ, nêu cụ thể bước tiếp theo.\n\nViết mạch lạc, tập trung vào lợi ích khách hàng và giữ đúng giọng thương hiệu [tone of voice]. Không tự bịa tính năng, kết quả, lời chứng thực, giá hoặc chính sách; đánh dấu phần cần bổ sung khi thiếu dữ liệu.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-ecommerce-product-copy",
    "title": "Viết mô tả sản phẩm TMĐT",
    "description": "Tạo mô tả dễ đọc, chuẩn SEO, nêu lợi ích và thúc đẩy mua hàng.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia copywriting thương mại điện tử. Hãy viết mô tả chi tiết cho [tên sản phẩm] để đăng bán trên [sàn thương mại điện tử].\n\nNội dung cần có:\n- 3–5 điểm nổi bật trình bày bằng bullet points.\n- Lợi ích chính khách hàng nhận được khi sử dụng sản phẩm.\n- Tối ưu SEO bằng [từ khóa chính] và các từ khóa liên quan, lặp lại tự nhiên, dễ đọc.\n- CTA rõ ràng, hấp dẫn, khuyến khích mua hàng.\n- 3–5 hashtag phù hợp với sản phẩm và đối tượng mục tiêu.\n\nTrình bày mạch lạc, dễ quét và tập trung vào nhu cầu người mua. Chỉ sử dụng thông số, chất liệu, công dụng, bảo hành và chính sách đã được cung cấp; không tự tạo tuyên bố về sản phẩm.",
    "owner": "igen"
  },
  {
    "id": "igen-marketing-press-release",
    "title": "Soạn thông cáo báo chí",
    "description": "Viết thông cáo khoảng 400 từ cho sự kiện, sản phẩm hoặc thành tựu.",
    "category": "Marketing",
    "prompt": "Bạn là chuyên gia quan hệ công chúng (PR). Hãy soạn thông cáo báo chí chuyên nghiệp, dài khoảng 400 từ, công bố [sự kiện/chủ đề].\n\nThông cáo cần có:\n- Tên công ty và vị trí đặt logo nếu có.\n- Ngày, địa điểm phát hành.\n- Tiêu đề ngắn gọn, nổi bật và thể hiện trọng tâm.\n- Tổng quan sản phẩm/thành tựu: tên, tính năng nổi bật và lợi ích cho khách hàng hoặc thị trường.\n- Bối cảnh ra đời: lý do phát triển và mục tiêu chiến lược của công ty.\n- Chi tiết sự kiện ra mắt: thời gian, địa điểm, hình thức tổ chức và diễn giả/nhân vật tham dự.\n- Trích dẫn của lãnh đạo cấp cao hoặc người phát ngôn về tầm quan trọng của sản phẩm/thành tựu.\n- Thông tin liên hệ dành cho phóng viên và đối tác truyền thông.\n- Kết luận ngắn về định hướng tương lai hoặc cam kết với khách hàng và thị trường.\n\nDùng văn phong trang trọng, khách quan, mạch lạc và súc tích; làm nổi bật thông tin có giá trị với báo chí. Đánh dấu dữ liệu còn thiếu bằng ngoặc vuông. Không tự tạo thông tin liên hệ, ngày giờ, người tham dự hoặc phát ngôn; nếu soạn lời trích dẫn đề xuất, ghi rõ cần người phát ngôn duyệt.",
    "owner": "igen"
  }
];

export const initialAssistantPromptFavorites = [
  "igen-marketing-competitor-analysis",
  "igen-marketing-customer-persona",
  "igen-marketing-kpi-plan",
  "igen-marketing-customer-journey"
];
