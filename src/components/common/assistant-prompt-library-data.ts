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
  },
  {
    "id": "igen-sales-outreach-plan-30d",
    "title": "Lập kế hoạch tiếp cận 30 ngày",
    "description": "Xây dựng mục tiêu, kênh, chuỗi tiếp cận và phương án dự phòng.",
    "category": "Kinh doanh",
    "prompt": "Bạn là trưởng nhóm Sales. Hãy lập kế hoạch tiếp cận khách hàng chi tiết cho [sản phẩm/dịch vụ], phù hợp với hành vi và nhu cầu của ICP [mô tả ICP].\n\nKế hoạch cần có:\n- Mục tiêu rõ ràng, đo lường được trong 30 ngày.\n- KPI chính để đánh giá hiệu quả.\n- Thông điệp giá trị cốt lõi và điểm khác biệt so với đối thủ.\n- Ba kênh tiếp cận ưu tiên, ví dụ cold call, email hoặc social media, kèm lý do chọn.\n- Tần suất tương tác trên từng kênh để duy trì kết nối mà không gây phiền.\n- Chuỗi tiếp cận năm bước kết hợp các kênh, nêu rõ nội dung và mục đích từng bước.\n- Tài nguyên cần chuẩn bị: nhân sự, công cụ, nội dung và dữ liệu.\n- Rủi ro tiềm ẩn cùng phương án dự phòng.\n\nLập kế hoạch thực tế, dễ triển khai. Nếu thiếu dữ liệu về ICP, ngân sách hoặc năng lực đội ngũ, hãy nêu giả định và đánh dấu phần cần xác nhận.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-competitor-analysis",
    "title": "Phân tích đối thủ phục vụ bán hàng",
    "description": "So sánh đối thủ và chuẩn bị thông điệp xử lý lập luận của khách hàng.",
    "category": "Kinh doanh",
    "prompt": "Bạn là chuyên gia phân tích cạnh tranh. Hãy phân tích ba đối thủ chính trên thị trường của [sản phẩm/dịch vụ], gồm:\n- Tính năng nổi bật của từng đối thủ so với sản phẩm của chúng ta.\n- Giá bán và mô hình thu phí: miễn phí, trả phí, freemium hoặc mô hình khác.\n- Giá trị cốt lõi mỗi đối thủ mang lại cho khách hàng.\n- Điểm mạnh và điểm yếu.\n- Case study tiêu biểu về thành công hoặc thất bại, nếu có dữ liệu kiểm chứng.\n- Chiến thuật bán hàng hiện tại mà từng đối thủ đang áp dụng.\n\nKết luận bằng lợi thế cạnh tranh khác biệt của sản phẩm chúng ta và đề xuất ba thông điệp bán hàng để trả lời lập luận của khách hàng dựa trên điểm yếu đã xác minh của đối thủ.\n\nVới thông tin giá, chiến thuật hiện tại và case study, ghi nguồn và thời điểm kiểm tra. Phân biệt dữ kiện với nhận định; không bịa thông tin hoặc hạ thấp đối thủ bằng tuyên bố thiếu căn cứ.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-telesales-script",
    "title": "Viết kịch bản telesales",
    "description": "Soạn cuộc gọi giới thiệu, khám phá nhu cầu và chốt lịch hẹn.",
    "category": "Kinh doanh",
    "prompt": "Bạn là trưởng phòng kinh doanh có kỹ năng telesales chuyên nghiệp. Hãy viết kịch bản gọi điện giới thiệu [sản phẩm/dịch vụ] cho [khách hàng/ICP] theo cấu trúc:\n- Mở đầu (5 giây): cá nhân hóa bằng [tên], [công ty] hoặc bối cảnh liên quan.\n- Giới thiệu giá trị (10 giây): nói ngắn gọn lợi ích khách hàng có thể nhận được.\n- Khám phá nhu cầu: đặt ba câu hỏi mở để tìm hiểu điểm đau và nhu cầu thực tế.\n- Xử lý phản đối: dự kiến ba phản đối phổ biến và trả lời phù hợp.\n- Bước tiếp theo: đề xuất hai khung giờ cụ thể cho cuộc hẹn hoặc hành động kế tiếp.\n- Chốt lịch: kết thúc bằng câu hỏi hoặc đề nghị rõ ràng.\n\nViết thành các đoạn thoại ngắn, chuyên nghiệp nhưng thân thiện. Dùng khung giờ được cung cấp; nếu chưa có lịch, để [khung giờ 1] và [khung giờ 2], không tự nhận lịch trống.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-intro-email",
    "title": "Soạn email chào hàng",
    "description": "Viết email giới thiệu giải pháp với lợi ích, bằng chứng và CTA cụ thể.",
    "category": "Kinh doanh",
    "prompt": "Bạn là trưởng phòng kinh doanh. Hãy viết một email chào hàng hoàn chỉnh giới thiệu [sản phẩm/dịch vụ] tới [khách hàng/ngành hàng].\n\nEmail cần có phần mở đầu cá nhân hóa, ba lợi ích gắn với ngành của khách hàng, một bằng chứng xã hội đã được cung cấp, đề xuất cuộc gọi 15 phút với hai khung giờ, CTA rõ ràng và chữ ký chuyên nghiệp.\n\nDùng ngôn ngữ ngắn gọn, trang trọng nhưng thân thiện, dễ hiểu và thuyết phục. Nếu chưa có bằng chứng xã hội hoặc thời gian rảnh, hãy dùng placeholder để bổ sung; không tự tạo tên khách hàng, kết quả hay lịch hẹn.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-customer-followup",
    "title": "Soạn email chăm sóc khách hàng",
    "description": "Theo sát khách hàng sau demo, triển khai hoặc gửi báo giá.",
    "category": "Kinh doanh",
    "prompt": "Bạn là Customer Success Manager (CSM). Hãy viết email chăm sóc khách hàng sau [demo/triển khai/gửi báo giá] về [sản phẩm/dịch vụ].\n\nEmail cần:\n- Tóm tắt ba điểm khách hàng quan tâm chính dựa trên bối cảnh được cung cấp.\n- Đề cập tài liệu hữu ích liên quan đến nhu cầu của khách hàng; dùng [tên tài liệu/đường dẫn] nếu chưa có tệp đính kèm thực tế.\n- Đề xuất next step cụ thể khách hàng nên thực hiện.\n- Đặt một câu hỏi để xác nhận nhu cầu hoặc mức độ quan tâm.\n- Nhắc deadline phản hồi [ngày].\n- Nêu người phụ trách hỗ trợ [tên, chức vụ, cách liên hệ].\n\nGiữ giọng điệu thân thiện, chuyên nghiệp và chủ động hỗ trợ. Không giả vờ đã đính kèm tài liệu hoặc tự đặt deadline, tên và thông tin liên hệ.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-csat-survey",
    "title": "Thiết kế khảo sát hài lòng khách hàng",
    "description": "Tạo khảo sát ngắn sau khi khách hàng sử dụng sản phẩm/dịch vụ.",
    "category": "Kinh doanh",
    "prompt": "Bạn là chuyên viên chăm sóc khách hàng (CSKH). Hãy thiết kế khảo sát mức độ hài lòng sau khi khách hàng sử dụng [sản phẩm/dịch vụ].\n\nBao gồm:\n1. Lời chào thân thiện và mục đích khảo sát.\n2. Sáu câu hỏi chấm theo thang 1–5, lần lượt về: trải nghiệm tổng thể, giá trị so với chi phí, độ dễ sử dụng, chất lượng hỗ trợ, hiệu quả sử dụng và khả năng giới thiệu cho người khác.\n3. Một câu hỏi mở để khách hàng góp ý.\n4. Hướng dẫn gửi phiếu qua [email/website/hotline].\n5. Lời cảm ơn chân thành và thông tin ưu đãi nhỏ [ưu đãi đã được duyệt] dành cho người tham gia.\n\nDùng ngôn ngữ rõ ràng, dễ hiểu, phù hợp với đối tượng khách hàng; trình bày logic và chuyên nghiệp. Nếu chưa có ưu đãi, để placeholder hoặc đề xuất phương án chờ phê duyệt, không tự hứa quyền lợi.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-complaint-response",
    "title": "Soạn phản hồi khiếu nại khách hàng",
    "description": "Phản hồi đồng cảm với kế hoạch xử lý, thời hạn và người phụ trách.",
    "category": "Kinh doanh",
    "prompt": "Bạn là đại diện hỗ trợ khách hàng chuyên nghiệp. Hãy viết phản hồi khiếu nại đồng cảm và rõ ràng cho [vấn đề cụ thể].\n\nPhản hồi cần có:\n1. Lời xin lỗi chân thành.\n2. Xác nhận ngắn gọn rằng bạn đã hiểu vấn đề của khách hàng.\n3. Giải thích nguyên nhân bằng ngôn ngữ dễ hiểu, chỉ khi nguyên nhân đã được xác minh; nếu chưa rõ, nói rằng đang kiểm tra.\n4. Ba bước xử lý cụ thể, kèm thời gian dự kiến hoàn tất từng bước.\n5. Tên hoặc vị trí người phụ trách.\n6. Đề xuất bồi thường/ưu đãi nếu có chính sách được duyệt.\n7. Kênh liên hệ nhanh để nhận hỗ trợ thêm.\n\nGiữ giọng điệu đồng cảm, chuyên nghiệp, rõ ràng và trấn an. Không tự nhận lỗi về nguyên nhân chưa xác minh, hứa thời hạn, bồi thường hoặc ưu đãi chưa được phê duyệt; dùng placeholder khi thiếu thông tin.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-pitch-deck-outline",
    "title": "Lập dàn ý Pitch Deck 10 slide",
    "description": "Xây dựng câu chuyện bán hàng từ vấn đề đến bước tiếp theo.",
    "category": "Kinh doanh",
    "prompt": "Bạn là chuyên gia bán hàng. Hãy lập dàn ý Pitch Deck gồm đúng 10 slide để trình bày [sản phẩm/dịch vụ] cho [khách hàng mục tiêu].\n\nVới mỗi slide, đề xuất tiêu đề và nội dung thuyết phục, dễ trình bày:\n1. Tiêu đề: tên giải pháp, slogan nếu có và thông điệp thu hút.\n2. Vấn đề: thách thức của khách hàng mục tiêu.\n3. Cơ hội/thị trường: quy mô, xu hướng và lý do đây là thời điểm phù hợp.\n4. Giải pháp: cách sản phẩm giải quyết vấn đề và điểm khác biệt.\n5. Tính năng nổi bật: tính năng, công nghệ hoặc phương pháp chính.\n6. Lợi ích định lượng: kết quả khách hàng có thể kỳ vọng.\n7. Case study/bằng chứng thành công, nếu có.\n8. So sánh với các đối thủ chính.\n9. Gói giá và ROI: lựa chọn giá cùng giá trị khách hàng nhận được.\n10. Kêu gọi hành động và bước tiếp theo.\n\nChỉ dùng số liệu, case study, giá và kết quả đã được cung cấp hoặc kiểm chứng. Đánh dấu thông tin còn thiếu; không tự tạo quy mô thị trường, cam kết ROI hoặc tuyên bố vượt trội.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-daily-activity-report",
    "title": "Tổng hợp báo cáo hoạt động bán hàng",
    "description": "Tóm tắt log gọi, email, cuộc hẹn và kế hoạch ngày mai.",
    "category": "Kinh doanh",
    "prompt": "Bạn là trưởng nhóm Sales. Dựa trên log/cuộc gọi/email trong [file số liệu], hãy viết báo cáo hoạt động bán hàng ngắn gọn gồm 3–5 gạch đầu dòng.\n\nBáo cáo cần nêu: tổng số cuộc gọi, số cuộc hẹn đạt được, cơ hội bán hàng mới, các phản đối nổi bật, bài học kinh nghiệm và kế hoạch cụ thể cho ngày mai. Có thể gộp các ý liên quan để giữ báo cáo trong 3–5 gạch đầu dòng.\n\nChỉ tổng hợp dữ liệu trong file. Nếu thiếu một chỉ số, ghi rõ chưa có dữ liệu; không tự suy đoán số liệu hoặc hoạt động.",
    "owner": "igen"
  },
  {
    "id": "igen-sales-pipeline-health",
    "title": "Đánh giá sức khỏe pipeline",
    "description": "Phân tích giá trị, chuyển đổi, rủi ro và dự báo pipeline.",
    "category": "Kinh doanh",
    "prompt": "Bạn là quản lý kinh doanh. Dựa trên [dữ liệu pipeline], hãy tóm tắt sức khỏe pipeline để hỗ trợ ra quyết định.\n\nTrình bày ngắn gọn, logic, gồm:\n- Tổng giá trị cơ hội theo từng giai đoạn bán hàng.\n- Tỷ lệ chuyển đổi giữa các giai đoạn.\n- Ba rủi ro lớn nhất và mức độ tác động.\n- Ba deal cần hỗ trợ khẩn cấp nhất trong tuần tới, lý do và loại hỗ trợ cần thiết.\n- Dự báo doanh thu kỳ tới và mức độ tin cậy (thấp/trung bình/cao), kèm căn cứ.\n- Ba khuyến nghị hành động cụ thể, khả thi cho tuần tới.\n\nChỉ tính toán từ dữ liệu được cung cấp. Nêu rõ cách tính và giả định; nếu thiếu kỳ dự báo, tỷ lệ thắng hoặc dữ liệu giai đoạn, hãy chỉ ra giới hạn thay vì bịa số.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-statement-analysis",
    "title": "Phân tích báo cáo tài chính",
    "description": "Đánh giá doanh thu, lợi nhuận, chi phí, dòng tiền và rủi ro.",
    "category": "Tài chính",
    "prompt": "Bạn là chuyên viên tài chính. Hãy phân tích [file báo cáo tài chính đính kèm], tập trung vào:\n- Doanh thu: mức tăng/giảm so với kỳ trước hoặc cùng kỳ năm trước và nguyên nhân được số liệu hỗ trợ.\n- Lợi nhuận: biến động lợi nhuận gộp, lợi nhuận sau thuế, các tỷ suất lợi nhuận và yếu tố tác động.\n- Chi phí: cơ cấu, khoản mục lớn, xu hướng và ảnh hưởng đến lợi nhuận.\n- Dòng tiền: hoạt động kinh doanh, đầu tư, tài chính và khả năng quản lý dòng tiền.\n- Rủi ro: nợ vay, thanh khoản, tỷ suất sinh lời hoặc rủi ro nổi bật khác; đề xuất hướng xử lý nếu có căn cứ.\n\nĐối chiếu số liệu giữa các kỳ và giải thích xu hướng một cách logic. Nêu đơn vị, kỳ báo cáo, công thức/chỉ số sử dụng; phân biệt dữ kiện với nhận định. Nếu thiếu trang hoặc số liệu, nói rõ giới hạn và không tự suy đoán nguyên nhân.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-product-assessment",
    "title": "Đánh giá sản phẩm tài chính",
    "description": "So sánh cấu trúc, lợi suất, rủi ro, phí và mức độ phù hợp.",
    "category": "Tài chính",
    "prompt": "Bạn là nhà phân tích tài chính. Hãy nghiên cứu [tên sản phẩm/kênh đầu tư] theo các tiêu chí:\n- Cấu trúc sản phẩm và cách tạo lợi nhuận.\n- Lợi suất kỳ vọng, phân biệt rõ với lợi suất lịch sử và không xem là mức được bảo đảm.\n- Mức độ và nguồn rủi ro.\n- Chi phí, phí giao dịch và các khoản phí liên quan.\n- Tính thanh khoản, điều kiện rút/chuyển nhượng và hạn chế.\n- Mức độ phù hợp với nhà đầu tư có hồ sơ rủi ro, mục tiêu và khả năng tài chính khác nhau.\n\nĐưa ra đánh giá sử dụng tổng quát cho ba nhóm khách hàng mục tiêu, nêu điều kiện phù hợp và trường hợp nên thận trọng. Dùng thông tin cập nhật, ghi nguồn và ngày kiểm tra; phân biệt dữ kiện, giả định và nhận định. Không hứa hẹn lợi suất hoặc thay thế tư vấn đầu tư cá nhân; nêu rõ các yếu tố cần nhà đầu tư tự xác minh.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-market-outlook-6m",
    "title": "Dự báo thị trường tài chính 6 tháng",
    "description": "Xây dựng hai kịch bản dự báo dựa trên vĩ mô, dòng tiền và kỹ thuật.",
    "category": "Tài chính",
    "prompt": "Bạn là chuyên gia phân tích thị trường. Hãy dự báo xu hướng trong sáu tháng tới của [sản phẩm tài chính cần dự báo].\n\nKết hợp các nhóm yếu tố:\n1. Vĩ mô: lạm phát, lãi suất và tăng trưởng GDP toàn cầu.\n2. Định giá hiện tại so với các mốc lịch sử và giá trị nội tại phù hợp với sản phẩm; nếu phân tích vàng, dùng các thước đo định giá vàng có căn cứ.\n3. Dòng tiền toàn cầu: đầu tư, dự trữ ngoại hối và biến động tiền tệ.\n4. Kỹ thuật: diễn biến giá, mô hình giá, RSI và MACD; nêu khung thời gian và giới hạn của chỉ báo.\n\nĐưa ra hai kịch bản có cơ sở nhất, mô tả điều kiện kích hoạt, xu hướng kỳ vọng và xác suất ước tính; xác suất của hai kịch bản cần cộng lại thành 100%. Ghi ngày dữ liệu, nguồn và giả định. Làm rõ bất định, không trình bày dự báo như cam kết hay khuyến nghị mua/bán cá nhân.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-capital-allocation",
    "title": "Lập kế hoạch sử dụng vốn",
    "description": "Lập lịch CAPEX/OPEX, vốn lưu động, dự trữ tiền và giải ngân.",
    "category": "Tài chính",
    "prompt": "Bạn là kế toán trưởng. Hãy lập kế hoạch sử dụng vốn cho [dự án] trong [thời gian cụ thể], cân đối hiệu quả đầu tư với khả năng thanh toán.\n\nKế hoạch cần gồm:\n- Danh mục CAPEX và OPEX, số tiền/ước tính, mức ưu tiên và căn cứ.\n- Tính vòng quay vốn lưu động dự kiến, nêu công thức, kỳ tính và giả định.\n- Thiết lập ngưỡng tiền mặt tối thiểu để duy trì thanh khoản, giải thích cơ sở.\n- Lịch giải ngân theo giai đoạn, mốc thời gian, điều kiện và số vốn cần giải ngân.\n\nLiên hệ kế hoạch với mục tiêu tài chính doanh nghiệp và nguyên tắc kế toán/quản trị tài chính áp dụng. Tách số liệu đã có khỏi giả định; đánh dấu dữ liệu còn thiếu. Không tự khẳng định tuân thủ một quy định cụ thể nếu chưa có thông tin về ngành và khu vực pháp lý.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-project-investment-appraisal",
    "title": "Thẩm định hiệu quả tài chính dự án",
    "description": "Tính NPV, IRR, thời gian hoàn vốn và độ nhạy của dự án.",
    "category": "Tài chính",
    "prompt": "Bạn là nhà phân tích đầu tư chuyên thẩm định dự án và mô hình hóa dòng tiền. Hãy đánh giá [mô tả dự án], gồm:\n- NPV: nêu suất chiết khấu/WACC, dòng tiền theo kỳ, thời điểm và giả định.\n- IRR: tính toán và so sánh với chi phí vốn/WACC.\n- Thời gian hoàn vốn thông thường và hoàn vốn chiết khấu.\n- Phân tích độ nhạy với ba biến chính, chọn trong doanh thu/giá bán, OPEX, CAPEX và suất chiết khấu; nêu biên độ thay đổi và ảnh hưởng đến NPV/IRR.\n- Khuyến nghị go/no-go, điều kiện tiên quyết và rủi ro chính cần giám sát.\n\nTrình bày công thức, đơn vị, giả định và cách xử lý dòng tiền rõ ràng; kiểm tra tính nhất quán của kết quả. Phù hợp với mục tiêu lợi nhuận và khẩu vị rủi ro doanh nghiệp. Nếu thiếu dữ liệu, nêu phần chưa thể tính thay vì tự tạo số liệu.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-risk-matrix",
    "title": "Lập ma trận rủi ro tài chính",
    "description": "Đánh giá rủi ro tỷ giá, lãi suất, tín dụng, thanh khoản và kiểm soát.",
    "category": "Tài chính",
    "prompt": "Bạn là chuyên viên quản trị rủi ro tài chính doanh nghiệp. Hãy lập ma trận rủi ro cho [doanh nghiệp] trong [thời gian cụ thể], gồm:\n- Rủi ro tỷ giá, lãi suất, tín dụng và thanh khoản: nguồn phát sinh, chỉ báo/tiêu chí đo lường và dữ liệu cần theo dõi.\n- Xác suất và tác động tài chính; xếp hạng theo ma trận Impact–Likelihood.\n- Giới hạn rủi ro đề xuất cho từng loại, ví dụ net open position, duration gap, tỷ lệ nợ xấu, LCR/NSFR khi phù hợp.\n- Công cụ phòng ngừa phù hợp: forward/swap/option cho tỷ giá; IRS/cap/floor cho lãi suất; bảo lãnh hoặc bảo hiểm tín dụng cho tín dụng; hạn mức dự phòng hoặc repo cho thanh khoản.\n- Quy trình giám sát và cảnh báo: tần suất đo lường, báo cáo vượt hạn mức, stress test và hành động ứng phó.\n\nChỉ đề xuất công cụ và ngưỡng phù hợp với hoạt động, năng lực và quy định áp dụng của doanh nghiệp. Nêu giả định, giới hạn của dữ liệu và yêu cầu xác minh pháp lý; không coi các ví dụ về hạn mức là chuẩn bắt buộc cho mọi doanh nghiệp.",
    "owner": "igen"
  },
  {
    "id": "igen-finance-break-even-analysis",
    "title": "Tính điểm hòa vốn",
    "description": "Tính sản lượng, doanh thu hòa vốn, biên an toàn và độ nhạy.",
    "category": "Tài chính",
    "prompt": "Bạn là kế toán quản trị. Hãy tính điểm hòa vốn cho [sản phẩm/dự án] trong [thời gian cụ thể], gồm:\n- Xác định chi phí cố định và chi phí biến đổi trên một đơn vị.\n- Tính sản lượng hòa vốn và doanh thu hòa vốn, nêu công thức và đơn vị.\n- Tính biên an toàn (margin of safety) theo sản lượng và doanh thu.\n- Phân tích thay đổi khi giá bán đơn vị, chi phí biến đổi đơn vị hoặc chi phí cố định biến động; cập nhật sản lượng và doanh thu hòa vốn tương ứng.\n- Đề xuất hành động quản trị về giá, kiểm soát chi phí và tối ưu sản lượng để cải thiện biên an toàn.\n\nNêu rõ kỳ tính, giả định về cơ cấu sản phẩm và dữ liệu đầu vào. Nếu biên lợi nhuận đóng góp bằng hoặc nhỏ hơn 0, giải thích rằng không thể đạt hòa vốn với cấu trúc giá/chi phí hiện tại. Không tự điền số liệu còn thiếu.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-labor-market-analysis",
    "title": "Phân tích thị trường lao động",
    "description": "Đánh giá nguồn ứng viên, lương, cạnh tranh và kênh tuyển dụng.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên viên nhân sự. Hãy phân tích thị trường lao động cho [ngành/khu vực/vị trí], tập trung vào:\n1. Nguồn cung ứng viên: trình độ, kinh nghiệm và phân bố địa lý.\n2. Mức lương tham chiếu theo cấp bậc và khu vực.\n3. Mức độ cạnh tranh tuyển dụng: doanh nghiệp/ngành cùng thu hút nhóm ứng viên.\n4. Kênh tuyển dụng hiệu quả: trực tuyến, mạng xã hội, headhunter và các kênh phù hợp khác.\n5. Xu hướng kỹ năng gần đây: kỹ năng mềm, chuyên môn và công nghệ.\n\nĐưa ra ba khuyến nghị chiến lược để tối ưu quy trình tuyển dụng và thu hút ứng viên chất lượng. Với số liệu lương và xu hướng hiện tại, ghi nguồn, thời điểm và phạm vi khảo sát; nêu giới hạn dữ liệu, không trình bày ước tính như dữ kiện chắc chắn.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-candidate-review",
    "title": "Đánh giá hồ sơ ứng viên",
    "description": "Đối chiếu CV với yêu cầu vị trí và đề xuất bước tuyển dụng tiếp theo.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên viên tuyển dụng. Hãy đánh giá [CV/thông tin ứng viên] cho vị trí [tên vị trí] theo cấu trúc:\n1. Tóm tắt kinh nghiệm liên quan.\n2. Kỹ năng nổi bật phù hợp với yêu cầu công việc.\n3. Thành tựu đáng chú ý, trích dẫn bằng chứng trong hồ sơ.\n4. Rủi ro hoặc khoảng trống liên quan trực tiếp đến hiệu suất công việc.\n5. Mức độ phù hợp từ 1–5: 1 Không phù hợp; 2 Hạn chế phù hợp; 3 Phù hợp cơ bản; 4 Khá phù hợp; 5 Rất phù hợp.\n6. Đề xuất bước tiếp theo: Phỏng vấn tiếp, Từ chối hoặc Cần thêm thông tin, kèm lý do ngắn gọn.\n\nĐánh giá nhất quán theo tiêu chí công việc được cung cấp. Không suy đoán khả năng dựa trên đặc điểm được bảo vệ hoặc thông tin cá nhân không liên quan; phân biệt bằng chứng trong CV với điều cần xác minh.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-job-description",
    "title": "Soạn mô tả công việc",
    "description": "Xây dựng JD gồm mục tiêu, nhiệm vụ, năng lực, KPI và điều kiện làm việc.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR. Hãy viết mô tả công việc chi tiết cho vị trí [tên vị trí], gồm:\n- Mục tiêu vị trí: vai trò và mục đích chính trong tổ chức.\n- Nhiệm vụ chính: 5–7 trách nhiệm cụ thể, có tính hành động.\n- Năng lực cứng: kỹ năng chuyên môn, bằng cấp, chứng chỉ hoặc kiến thức cần thiết.\n- Năng lực mềm: giao tiếp, làm việc nhóm, giải quyết vấn đề và thái độ phù hợp.\n- KPI cơ bản: 3–5 chỉ số đánh giá hiệu quả.\n- Điều kiện làm việc: môi trường, địa điểm/di chuyển/làm từ xa, thời gian và yếu tố đặc thù.\n- Đãi ngộ tham chiếu nếu có: lương, thưởng, phúc lợi và hỗ trợ.\n\nDùng ngôn ngữ chuyên nghiệp, rõ ràng và phù hợp chuẩn mực HR hiện đại. Phân biệt yêu cầu bắt buộc với ưu tiên; không tự đặt lương, chế độ hoặc điều kiện chưa được cung cấp.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-job-posting",
    "title": "Viết tin tuyển dụng",
    "description": "Tạo tin tuyển dụng ngắn gọn, rõ yêu cầu, quyền lợi và cách ứng tuyển.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên viên tuyển dụng. Hãy viết tin tuyển dụng ngắn gọn, thu hút cho vị trí [tên vị trí], gồm:\n- Giới thiệu công ty trong 1–2 câu về tầm nhìn, sứ mệnh hoặc điểm nổi bật.\n- 4–6 nhiệm vụ chính dưới dạng gạch đầu dòng.\n- Yêu cầu cốt lõi về trình độ, kinh nghiệm, kỹ năng và phẩm chất.\n- Quyền lợi nổi bật công ty thực sự cung cấp.\n- Địa điểm/hình thức làm việc.\n- Khoảng lương nếu đã được cung cấp.\n- Hạn nộp hồ sơ và hướng dẫn ứng tuyển cụ thể.\n\nGiữ ngôn từ chuyên nghiệp, súc tích, dễ hiểu và phù hợp phong cách tuyển dụng hiện đại. Dùng placeholder cho dữ liệu còn thiếu; không tự tạo thông tin về lương, quyền lợi hoặc công ty.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-interview-questions",
    "title": "Soạn bộ câu hỏi phỏng vấn",
    "description": "Tạo câu hỏi theo nhóm năng lực cùng tiêu chí chấm điểm.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên viên tuyển dụng. Hãy tạo bộ 8–12 câu hỏi phỏng vấn cho vị trí [tên vị trí], chia đều cho bốn nhóm:\n1. Chuyên môn/kỹ thuật.\n2. Tình huống hành vi.\n3. Phù hợp với giá trị và cách làm việc của công ty.\n4. Tư duy phản biện và khả năng học hỏi.\n\nMỗi câu hỏi cần sát với yêu cầu vị trí, có tính ứng dụng thực tế và kèm tiêu chí chấm điểm ngắn gọn, rõ ràng. Dùng thang điểm nhất quán 1–5 với mô tả ngắn về bằng chứng cho điểm thấp, trung bình và cao. Tránh câu hỏi xâm phạm đời tư hoặc không liên quan đến công việc.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-candidate-email",
    "title": "Soạn email trao đổi với ứng viên",
    "description": "Viết email mời, nhắc lịch, cảm ơn hoặc từ chối ứng viên.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR. Hãy soạn email [mời phỏng vấn/nhắc lịch/cảm ơn/từ chối] ứng viên cho vị trí [vị trí công việc].\n\nEmail cần có:\n- Mục đích và lời chào phù hợp.\n- Thời gian phỏng vấn [ngày, giờ, múi giờ] nếu liên quan.\n- Hình thức phỏng vấn [trực tiếp/trực tuyến và nền tảng].\n- Thông tin người liên hệ [họ tên, chức vụ, điện thoại, email].\n- Tài liệu hoặc nội dung ứng viên cần chuẩn bị nếu có.\n- CTA yêu cầu xác nhận hoặc phản hồi trước [thời hạn].\n\nGiữ email ngắn gọn, rõ ràng, lịch sự và tôn trọng ứng viên. Không tự tạo lịch, thông tin liên hệ hoặc yêu cầu chuẩn bị; dùng placeholder cho dữ liệu còn thiếu.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-employment-contract",
    "title": "Soạn dự thảo hợp đồng lao động",
    "description": "Tạo bản nháp theo thông tin thỏa thuận và yêu cầu pháp lý Việt Nam.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR C&B. Hãy soạn dự thảo hợp đồng lao động cho ứng viên dựa trên:\n- Vị trí: [tên vị trí].\n- Loại/thời hạn hợp đồng: [thử việc/chính thức/thời vụ và thời hạn].\n- Mức lương: [số tiền và kỳ trả lương].\n- Phụ cấp: [mô tả].\n- Thời giờ làm việc, lịch làm việc và chế độ nghỉ.\n- Điều khoản bảo mật.\n- Quy định chấm dứt hợp đồng.\n\nBổ sung các nội dung bắt buộc phù hợp với hợp đồng lao động tại Việt Nam, dùng ngôn ngữ rõ ràng, logic và đánh dấu [cần bổ sung] khi thiếu thông tin. Nêu căn cứ pháp lý và ngày kiểm tra nếu có thể xác minh; không trích dẫn điều khoản chưa kiểm chứng. Ghi rõ đây là bản dự thảo cần bộ phận pháp chế/người có thẩm quyền rà soát trước khi ký, không cam kết hiệu lực pháp lý.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-onboarding-30-60-90",
    "title": "Thiết kế onboarding 30–60–90 ngày",
    "description": "Lập lộ trình hòa nhập, đào tạo, quyền truy cập và đánh giá.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR Ops. Hãy thiết kế chương trình onboarding 30–60–90 ngày cho [bộ phận/vị trí], gồm:\n- Mục tiêu và kết quả kỳ vọng tại mốc 30, 60 và 90 ngày.\n- Lịch đào tạo theo từng tuần, nội dung, hình thức và người phụ trách.\n- Mentor: người kèm cặp, vai trò và trách nhiệm hỗ trợ.\n- Checklist công cụ, phần mềm, tài khoản và quyền truy cập cần thiết.\n- Tiêu chí đánh giá hoàn thành tại từng mốc.\n- Hoạt động gắn kết nhóm và giúp nhân viên hòa nhập văn hóa.\n\nTrình bày rõ ràng, có thể triển khai trong thực tiễn doanh nghiệp. Phân biệt nội dung chung với nội dung cần tùy chỉnh theo vị trí; dùng placeholder nếu chưa có tên người phụ trách hoặc công cụ cụ thể.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-employee-survey",
    "title": "Thiết kế khảo sát nhân sự",
    "description": "Tạo khảo sát trung lập với thang Likert và hướng dẫn tính điểm.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên viên nhân sự. Hãy thiết kế khảo sát để đo lường [mục đích khảo sát] cho nhân viên.\n\nYêu cầu:\n- 10–15 câu hỏi theo thang Likert 5 mức từ “Hoàn toàn không đồng ý” đến “Hoàn toàn đồng ý”.\n- Hai câu hỏi mở để nhân viên góp ý.\n- Chia câu hỏi thành các nhóm chủ đề rõ ràng, phù hợp mục đích, ví dụ môi trường làm việc, cơ hội phát triển hoặc văn hóa doanh nghiệp.\n- Hướng dẫn tính điểm trung bình cho từng nhóm và toàn khảo sát, nêu cách xử lý câu bỏ trống.\n\nCâu hỏi phải trung lập, dễ hiểu và không dẫn dắt câu trả lời. Tránh thu thập dữ liệu cá nhân không cần thiết; nêu rõ cách bảo vệ tính riêng tư nếu khảo sát được thiết kế ẩn danh.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-recruitment-report",
    "title": "Lập báo cáo tuyển dụng",
    "description": "Tổng hợp phễu tuyển dụng, chi phí, thời gian và điểm nghẽn.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR. Dựa trên [dữ liệu tuyển dụng] của [bộ phận/công ty], hãy lập báo cáo tuyển dụng gồm:\n- Số vị trí mở và tỷ lệ vị trí đã tuyển đủ.\n- Tổng CV nhận được và số ứng viên qua từng vòng.\n- Số offer gửi đi và số ứng viên nhận việc.\n- Thời gian tuyển dụng trung bình (TAT), nêu cách tính và kỳ đo.\n- Chi phí theo từng kênh: website, headhunter, mạng xã hội và kênh khác.\n\nSau phần tổng hợp, phân tích ba điểm nghẽn của kỳ này và đề xuất ba hành động cụ thể, khả thi cho kỳ tới. Trình bày rõ định nghĩa và mẫu số của các tỷ lệ; chỉ dùng số liệu được cung cấp, nêu dữ liệu thiếu và không tự suy đoán nguyên nhân.",
    "owner": "igen"
  },
  {
    "id": "igen-hr-workforce-report",
    "title": "Lập báo cáo nhân sự tổng quan",
    "description": "Phân tích headcount, cơ cấu, biến động, hiện diện, OT và chi phí.",
    "category": "Nhân sự",
    "prompt": "Bạn là chuyên gia HR. Dựa trên [tệp dữ liệu nhân sự], hãy lập báo cáo cho kỳ [thời gian], trình bày bằng bảng tóm tắt và nhận định xu hướng dựa trên số liệu.\n\nBáo cáo gồm:\n1. Headcount cuối kỳ.\n2. Cơ cấu theo phòng ban, cấp bậc, giới tính và nhóm tuổi.\n3. Biến động: số nhân viên vào/ra trong kỳ và lý do chính nếu có dữ liệu.\n4. Turnover rate: nêu công thức, so sánh kỳ trước hoặc mục tiêu công ty.\n5. Attendance rate: nêu cách tính và phân tích nghỉ có phép/không phép nếu dữ liệu cho phép.\n6. OT: tổng giờ, phân bổ theo phòng ban và vị trí.\n7. Chi phí nhân công: lương cơ bản, OT, thưởng và phúc lợi.\n\nĐưa ra kiến nghị cụ thể để cải thiện quản trị nhân sự. Nêu kỳ báo cáo, công thức, mẫu số, giới hạn dữ liệu và không tự quy kết nguyên nhân. Chỉ báo cáo số liệu tổng hợp; không đưa tên hoặc thông tin nhận dạng nhân viên vào kết quả.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-regulation-draft",
    "title": "Soạn dự thảo văn bản quy phạm pháp luật",
    "description": "Lập dự thảo theo chủ đề, căn cứ pháp lý và đánh giá tác động sơ bộ.",
    "category": "Hành chính công",
    "prompt": "Bạn là chuyên viên pháp chế. Hãy lập dự thảo văn bản quy phạm pháp luật về [chủ đề/nội dung/vấn đề] trong phạm vi thẩm quyền của [cơ quan/cấp ban hành].\n\nDự thảo cần đúng thể thức áp dụng, nêu căn cứ pháp lý, đối tượng/phạm vi điều chỉnh, nội dung quy định và điều khoản tổ chức thi hành; kèm đánh giá tác động sơ bộ theo yêu cầu hiện hành, gồm nhóm chịu tác động, chi phí/nguồn lực, lợi ích và phương án thực hiện.\n\nKiểm tra hiệu lực, thẩm quyền và nội dung căn cứ tại thời điểm soạn; ghi nguồn và ngày kiểm tra. Không tự tạo số hiệu, điều khoản hoặc thẩm quyền. Đánh dấu phần thiếu bằng placeholder và ghi rõ đây là bản nháp cần thẩm định pháp lý trước khi trình ban hành.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-official-notice",
    "title": "Soạn thông báo hành chính",
    "description": "Viết thông báo chính thức với đối tượng, thời hạn và đầu mối liên hệ.",
    "category": "Hành chính công",
    "prompt": "Bạn là cán bộ văn phòng. Hãy soạn thông báo chính thức gửi [cơ quan/đơn vị/cá nhân liên quan] về [nội dung cụ thể].\n\nThông báo cần nêu:\n- Đối tượng áp dụng.\n- Nội dung và phạm vi thực hiện.\n- Thời hạn hoặc thời gian áp dụng.\n- Đầu mối liên hệ: [tên người/tổ chức, điện thoại, email, địa điểm].\n- Các hướng dẫn cần thiết để người nhận thực hiện đúng.\n\nTrình bày ngắn gọn, logic, đúng thể thức văn bản hành chính và phù hợp ngữ cảnh. Dùng placeholder cho số hiệu, ngày tháng, người ký hoặc thông tin liên hệ chưa được cung cấp; không tự tạo dữ liệu.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-official-dispatch",
    "title": "Soạn công văn hành chính",
    "description": "Tạo công văn có căn cứ, nội dung đề nghị và trách nhiệm thực hiện.",
    "category": "Hành chính công",
    "prompt": "Bạn là cán bộ văn phòng. Hãy soạn công văn về [nội dung/vấn đề] theo thể thức văn bản hành chính nhà nước, gồm:\n- Quốc hiệu, tiêu ngữ.\n- Số và ký hiệu văn bản; địa danh, ngày tháng.\n- Cơ quan nhận và trích yếu.\n- Căn cứ pháp lý hoặc căn cứ nghiệp vụ.\n- Nội dung yêu cầu/đề nghị/rà soát và phạm vi áp dụng.\n- Thời hạn thực hiện.\n- Đơn vị/cá nhân chịu trách nhiệm và nơi nhận.\n- Chức vụ, người ký và dấu theo quy trình của cơ quan.\n\nDùng ngôn ngữ chuẩn mực, rõ ràng, dễ thực hiện. Để placeholder ở thông tin chưa cung cấp; không tự đặt số văn bản, người ký hoặc căn cứ pháp lý chưa xác minh.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-official-reply",
    "title": "Soạn văn bản trả lời công văn",
    "description": "Phản hồi công văn theo hồ sơ, căn cứ và phương án xử lý cụ thể.",
    "category": "Hành chính công",
    "prompt": "Bạn là cán bộ được giao xử lý công văn. Hãy soạn văn bản trả lời công văn số [số hiệu, ngày, cơ quan gửi] về [nội dung/vấn đề].\n\nTrình bày:\n- Thông tin tiếp nhận và nội dung đề nghị của cơ quan gửi.\n- Căn cứ pháp lý hoặc kết quả tra cứu hồ sơ.\n- Kết quả xem xét và ý kiến cụ thể: đồng ý, không đồng ý hoặc đề nghị bổ sung, kèm lý do.\n- Thời hạn hoặc bước tiếp theo.\n- Đầu mối liên hệ và nơi nhận.\n\nBảo đảm đúng thể thức, ngắn gọn và khả thi. Chỉ nêu kết quả được hồ sơ/căn cứ hỗ trợ; dùng placeholder cho thông tin chưa có, không tự khẳng định đã tra cứu hoặc phê duyệt.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-procedure-guide",
    "title": "Hướng dẫn thủ tục hành chính",
    "description": "Tổng hợp hồ sơ, biểu mẫu, thời hạn và phí của thủ tục.",
    "category": "Hành chính công",
    "prompt": "Bạn là chuyên viên bộ phận một cửa. Hãy soạn hướng dẫn cho thủ tục [tên thủ tục], gồm:\n- Thành phần hồ sơ cần chuẩn bị.\n- Biểu mẫu liên quan, tên và số hiệu nếu có.\n- Nơi, cách thức nộp và cách nhận kết quả.\n- Thời hạn giải quyết theo quy định.\n- Phí/lệ phí nếu có.\n- Căn cứ pháp lý và đầu mối hỗ trợ nếu được cung cấp.\n\nTrình bày theo thứ tự người dân/tổ chức cần thực hiện, rõ ràng và dễ hiểu. Kiểm tra quy định hiện hành, ghi nguồn và ngày cập nhật; không tự tạo thành phần hồ sơ, biểu mẫu, thời hạn hoặc mức phí. Đánh dấu thông tin cần cơ quan có thẩm quyền xác nhận.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-application-review",
    "title": "Rà soát hồ sơ thủ tục hành chính",
    "description": "Chỉ ra hồ sơ thiếu và hướng dẫn bổ sung theo căn cứ hiện hành.",
    "category": "Hành chính công",
    "prompt": "Bạn là cán bộ chuyên môn. Hãy rà soát hồ sơ thủ tục [tên thủ tục] do [tổ chức/cá nhân] nộp, đối chiếu với yêu cầu pháp lý và danh mục hồ sơ được cung cấp.\n\nTrình bày:\n- Thành phần đã có và kết quả kiểm tra từng mục.\n- Thiếu sót về thành phần, nội dung hoặc cách thức nộp, nếu có.\n- Căn cứ cụ thể cho từng yêu cầu bổ sung.\n- Hướng dẫn chi tiết cách hoàn thiện và thời hạn bổ sung theo quy định.\n- Đầu mối hoặc bước xử lý tiếp theo.\n\nKhông yêu cầu tài liệu ngoài quy định đã xác minh và không tự suy đoán hồ sơ giả/không hợp lệ. Nếu chưa có căn cứ hoặc hồ sơ tham chiếu, nêu rõ cần bổ sung thông tin trước khi kết luận.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-decision-draft",
    "title": "Soạn dự thảo quyết định hành chính",
    "description": "Soạn quyết định với căn cứ, thẩm quyền, hiệu lực và trách nhiệm thi hành.",
    "category": "Hành chính công",
    "prompt": "Bạn là chuyên viên pháp lý. Hãy soạn dự thảo quyết định về [nội dung cụ thể], gồm:\n- Căn cứ pháp lý chính xác và còn hiệu lực.\n- Cơ quan/người có thẩm quyền ký ban hành.\n- Nội dung quyết định, đối tượng và phạm vi áp dụng.\n- Ngày có hiệu lực, thời hạn thực hiện nếu có.\n- Trách nhiệm tổ chức thi hành của cơ quan, đơn vị hoặc cá nhân liên quan.\n- Nơi nhận và phần ký theo thể thức áp dụng.\n\nBảo đảm logic, chặt chẽ và có tính thực tiễn. Kiểm tra căn cứ, thẩm quyền và thể thức theo quy định hiện hành; ghi nguồn và ngày kiểm tra. Không tự tạo số hiệu, người ký hoặc hiệu lực. Đánh dấu nội dung cần xác nhận và coi đây là bản nháp cần thẩm định trước khi ban hành.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-public-budget-estimate",
    "title": "Lập dự toán ngân sách công",
    "description": "Dự toán các khoản chi, căn cứ và biện pháp sử dụng ngân sách hiệu quả.",
    "category": "Hành chính công",
    "prompt": "Bạn là kế toán hành chính. Hãy lập dự toán chi tiết cho [đơn vị/chương trình], gồm:\n1. Cơ cấu khoản chi theo danh mục như tiền lương, vật tư, dịch vụ công và đầu tư tài sản; nêu số lượng, đơn giá, thành tiền và mức ưu tiên nếu có dữ liệu.\n2. Căn cứ pháp lý/tài chính cho từng khoản chi, gồm văn bản áp dụng và điều khoản liên quan.\n3. Thuyết minh biện pháp tiết kiệm, nâng cao hiệu quả sử dụng ngân sách và bảo đảm đúng mục tiêu.\n\nTrình bày theo cấu trúc phù hợp quản lý tài chính công, nêu công thức, giả định và nguồn số liệu. Chỉ viện dẫn quy định đã kiểm chứng còn hiệu lực; không tự tạo định mức, đơn giá hoặc căn cứ. Đánh dấu phần cần cơ quan tài chính/pháp chế xác nhận.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-tender-documents",
    "title": "Lập dự thảo hồ sơ mời thầu",
    "description": "Chuẩn bị tiêu chí, tiến độ và điều kiện hợp đồng minh bạch, cạnh tranh.",
    "category": "Hành chính công",
    "prompt": "Bạn là bên mời thầu. Hãy lập dự thảo hồ sơ mời thầu cho gói [tên gói], dựa trên phạm vi, dự toán và yêu cầu đã được phê duyệt.\n\nDự thảo gồm:\n1. Yêu cầu kỹ thuật đối với nhà thầu và hàng hóa/dịch vụ.\n2. Tiêu chuẩn, phương pháp đánh giá hồ sơ dự thầu về kỹ thuật, tài chính, năng lực và kinh nghiệm.\n3. Tiến độ từ phát hành hồ sơ, đóng/mở thầu, đánh giá, phê duyệt kết quả đến ký hợp đồng và triển khai.\n4. Điều kiện hợp đồng: thanh toán, bảo hành, xử lý vi phạm và nghĩa vụ các bên.\n\nTuân thủ quy định đấu thầu hiện hành, bảo đảm công khai, minh bạch, cạnh tranh và không cài tiêu chí hướng tới một nhà cung cấp. Ghi nguồn/ngày kiểm tra; dùng placeholder cho dữ liệu thiếu; đánh dấu dự thảo cần bộ phận đấu thầu/pháp chế thẩm định trước phát hành.",
    "owner": "igen"
  },
  {
    "id": "igen-gov-feedback-workflow",
    "title": "Xây dựng quy trình xử lý phản ánh",
    "description": "Thiết kế luồng tiếp nhận, thời hạn và kênh chính thức cho người dân.",
    "category": "Hành chính công",
    "prompt": "Bạn là bộ phận tiếp nhận phản ánh. Hãy xây dựng quy trình tiếp nhận và xử lý phản hồi về [chủ đề cụ thể], từ lúc nhận thông tin đến khi giải quyết và thông báo kết quả.\n\nVới mỗi giai đoạn, nêu: người/bộ phận phụ trách, thao tác, dữ liệu cần ghi nhận, thời hạn xử lý và cách cập nhật cho người gửi. Bao gồm bước phân loại/chuyển đơn vị, xác minh, giải quyết, phản hồi, lưu hồ sơ và xử lý trường hợp quá hạn hoặc không thuộc thẩm quyền.\n\nLiệt kê các kênh liên hệ chính thức đã được cung cấp như tổng đài, email, website, ứng dụng hoặc bộ phận một cửa. Phân biệt thời hạn theo luật với SLA nội bộ đề xuất; không tự công bố kênh liên hệ hay thời hạn pháp lý chưa được xác minh.",
    "owner": "igen"
  },
  {
    "id": "igen-it-code-generation",
    "title": "Viết mã theo yêu cầu",
    "description": "Tạo code rõ ràng, xử lý ngoại lệ và tuân thủ convention.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là lập trình viên chuyên nghiệp. Hãy viết mã cho [chức năng/module cụ thể] bằng [ngôn ngữ lập trình], dựa trên yêu cầu [mô tả yêu cầu].\n\nTuân thủ coding convention phổ biến hoặc quy chuẩn dự án nếu được cung cấp; tổ chức code rõ ràng, dễ bảo trì và mở rộng; xử lý các ngoại lệ có thể xảy ra; cân nhắc hiệu năng và tài nguyên. Thêm comment khi giúp làm rõ quyết định không hiển nhiên và ví dụ sử dụng nếu phù hợp.\n\nChỉ dùng thư viện/API đã được xác nhận. Nêu giả định hoặc thông tin còn thiếu; không tuyên bố mã đã chạy nếu chưa được thực thi.",
    "owner": "igen"
  },
  {
    "id": "igen-it-test-case-design",
    "title": "Thiết kế bộ test case",
    "description": "Bao phủ positive, negative, boundary và edge cases.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là QA Engineer. Hãy tạo bộ test case chi tiết cho [chức năng/module], bao phủ:\n- Positive cases.\n- Negative cases.\n- Boundary cases.\n- Edge cases và tình huống sử dụng thực tế.\n\nVới mỗi test case, cung cấp mã/tên, mục đích, tiền điều kiện nếu có, bước thực hiện, dữ liệu đầu vào và kết quả mong đợi. Sắp xếp theo mức độ ưu tiên và nhóm kịch bản để dễ thực thi.\n\nĐối chiếu với yêu cầu được cung cấp; chỉ ra giả định hoặc yêu cầu chưa rõ. Không khẳng định đã thực thi test nếu mới chỉ thiết kế test case.",
    "owner": "igen"
  },
  {
    "id": "igen-it-code-review-quality",
    "title": "Review chất lượng code",
    "description": "Đánh giá logic, convention, hiệu năng, bảo mật và khả năng mở rộng.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là senior developer. Hãy review [code/file đính kèm] dựa trên:\n1. Đúng yêu cầu: logic và chức năng có đáp ứng yêu cầu không.\n2. Coding standard: conventions, naming, cấu trúc và comment.\n3. Hiệu năng: tốc độ, tài nguyên và bộ nhớ.\n4. Bảo mật: rủi ro và điểm có thể bị khai thác.\n5. Khả năng mở rộng, bảo trì và tích hợp.\n\nTrình bày phát hiện theo mức độ ưu tiên, kèm vị trí cụ thể, bằng chứng, tác động và cách khắc phục. Phân biệt lỗi xác nhận được với giả định; nếu không thấy vấn đề trong một tiêu chí, ghi rõ phạm vi đã xem xét. Không suy đoán hành vi chưa thể xác định từ code được cung cấp.",
    "owner": "igen"
  },
  {
    "id": "igen-it-test-case-review",
    "title": "Review bộ test case",
    "description": "Đánh giá độ bao phủ, tính logic và cơ hội tự động hóa.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là test lead. Hãy review bộ test case cho [chức năng/module], tập trung:\n1. Độ bao phủ yêu cầu và kịch bản nghiệp vụ.\n2. Tính đầy đủ, logic của các bước; trường hợp biên, lỗi và cách dùng thực tế.\n3. Khả năng phát hiện lỗi, tính rõ ràng và khả năng tái sử dụng.\n4. Test case còn thiếu cần bổ sung.\n5. Cải tiến quy trình: sắp xếp, phân loại và tự động hóa nếu phù hợp.\n\nTrình bày có cấu trúc, nêu ví dụ cụ thể và liên kết từng phát hiện với yêu cầu/test case tương ứng nếu dữ liệu cho phép. Phân biệt thiếu sót chắc chắn với đề xuất bổ sung.",
    "owner": "igen"
  },
  {
    "id": "igen-it-database-design",
    "title": "Thiết kế cấu trúc cơ sở dữ liệu",
    "description": "Đề xuất bảng, quan hệ, index, constraints và tối ưu truy vấn.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là database engineer. Hãy thiết kế cấu trúc cơ sở dữ liệu cho [ứng dụng/module], hỗ trợ các chức năng chính [danh sách chức năng].\n\nTrình bày:\n- Các bảng/collection, trường, kiểu dữ liệu và khóa chính.\n- Quan hệ giữa các thực thể, khóa ngoại hoặc cách tham chiếu.\n- Index đề xuất, truy vấn được hỗ trợ và đánh đổi hiệu năng.\n- Constraints, quy tắc toàn vẹn và xử lý dữ liệu trùng/thiếu.\n- Gợi ý tối ưu truy vấn, phân trang và tăng trưởng dữ liệu.\n\nNêu giả định về DBMS, quy mô và tải nếu chưa được cung cấp. Ưu tiên thiết kế rõ ràng, mở rộng được và đảm bảo toàn vẹn dữ liệu; không khẳng định hiệu năng định lượng nếu chưa benchmark.",
    "owner": "igen"
  },
  {
    "id": "igen-it-api-documentation",
    "title": "Viết tài liệu API",
    "description": "Tài liệu endpoint, tham số, xác thực, response và ví dụ.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là backend developer. Hãy viết tài liệu API cho [service/module], gồm:\n- Danh sách endpoint và HTTP method.\n- Path/query parameters và request body, kiểu dữ liệu, trường bắt buộc.\n- Cấu trúc response và các mã HTTP phổ biến như 200, 201, 400, 401, 404, 500.\n- Cơ chế xác thực, headers và quyền cần thiết.\n- Ví dụ request/response thực tế, đã ẩn thông tin nhạy cảm.\n\nTrình bày có cấu trúc và dễ dùng khi tích hợp. Dựa trên code/spec được cung cấp; ghi rõ endpoint hoặc hành vi chưa xác minh, không tự tạo contract, token, credential hoặc ví dụ chứa dữ liệu thật.",
    "owner": "igen"
  },
  {
    "id": "igen-it-automation-test-script",
    "title": "Viết script kiểm thử tự động",
    "description": "Tạo test script ổn định, dễ bảo trì và có báo cáo lỗi.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là automation tester. Hãy viết script kiểm thử tự động cho [chức năng/flow] bằng [framework/tool phù hợp].\n\nYêu cầu:\n- Ổn định: xử lý đồng bộ, timeout và ngoại lệ; tránh selector hoặc dữ liệu brittle.\n- Dễ bảo trì: cấu trúc module rõ ràng, dùng Page Object Model khi phù hợp, tách dữ liệu khỏi logic và tuân thủ convention dự án.\n- Báo cáo: tích hợp [Allure/ExtentReports/công cụ phù hợp], log bước chạy và đính kèm screenshot khi thất bại nếu công cụ hỗ trợ.\n- Nêu cách cài đặt/chạy và cấu hình cần thiết.\n\nDùng phiên bản, selector và môi trường đã cung cấp. Nếu thiếu thông tin quan trọng, liệt kê giả định/đầu vào cần bổ sung và không bịa endpoint, credentials hoặc cấu hình.",
    "owner": "igen"
  },
  {
    "id": "igen-it-bug-analysis-fix",
    "title": "Phân tích và khắc phục bug",
    "description": "Tìm root cause, đề xuất sửa lỗi và kiểm tra regression.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là developer. Hãy phân tích và khắc phục [mã lỗi/mô tả] trong [module/chức năng]:\n1. Xác định root cause dựa trên log, code và các bước tái hiện.\n2. Đề xuất và triển khai giải pháp cụ thể, giải thích vì sao giải quyết đúng nguyên nhân.\n3. Xác định kiểm tra regression cần thực hiện và các chức năng có thể bị ảnh hưởng.\n\nNếu có repository, tuân thủ kiến trúc/convention hiện có và chỉ sửa phạm vi cần thiết. Phân biệt nguyên nhân đã xác nhận với giả thuyết; không tuyên bố lỗi đã khắc phục hoặc regression đã qua nếu chưa thực hiện kiểm tra.",
    "owner": "igen"
  },
  {
    "id": "igen-it-technical-specification",
    "title": "Chuyển yêu cầu thành đặc tả kỹ thuật",
    "description": "Tạo user stories, acceptance criteria, data model và mô tả UI/UX.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là business analyst chuyên nghiệp. Hãy chuyển yêu cầu [chức năng/module] thành đặc tả kỹ thuật đầy đủ, gồm:\n- Bối cảnh, mục tiêu, phạm vi và các giả định.\n- User stories theo vai trò người dùng.\n- Acceptance criteria cụ thể, đo lường được, gồm trường hợp thành công, lỗi và quyền truy cập.\n- Data model và quan hệ dữ liệu.\n- Luồng nghiệp vụ, trạng thái và xử lý ngoại lệ.\n- Mockup UI/UX dạng mô tả hoặc wireframe văn bản, kèm trải nghiệm người dùng.\n- Câu hỏi còn mở và tiêu chí nghiệm thu.\n\nBảo đảm các phần nhất quán, đủ thông tin để đội phát triển triển khai. Phân biệt yêu cầu đã xác nhận với đề xuất; không tự quyết định quy tắc nghiệp vụ quan trọng khi đầu vào chưa nêu.",
    "owner": "igen"
  },
  {
    "id": "igen-it-security-assessment",
    "title": "Đánh giá bảo mật OWASP",
    "description": "Tìm rủi ro OWASP, xếp hạng mức độ và đề xuất biện pháp khắc phục.",
    "category": "Công nghệ thông tin",
    "prompt": "Bạn là security engineer. Hãy đánh giá bảo mật [ứng dụng/API] trong phạm vi được ủy quyền, tập trung vào các rủi ro thuộc OWASP Top 10.\n\nVới mỗi phát hiện, trình bày: loại rủi ro, thành phần bị ảnh hưởng, bằng chứng an toàn có thể kiểm chứng, điều kiện khai thác, tác động, mức độ nghiêm trọng theo CVSS hoặc mô hình tương tự, và biện pháp khắc phục cụ thể. Nêu rõ phạm vi, phương pháp, giả định và giới hạn đánh giá.\n\nChỉ thực hiện hoặc đề xuất kiểm thử trên hệ thống/tài sản được phép, theo cách không gây gián đoạn hay phá hủy dữ liệu. Không thực hiện khai thác trái phép, truy cập dữ liệu thật hoặc hành động vượt phạm vi. Phân biệt phát hiện xác nhận được với rủi ro cần kiểm tra thêm.",
    "owner": "igen"
  },
  {
    "id": "igen-education-lesson-plan",
    "title": "Soạn giáo án chi tiết",
    "description": "Lập mục tiêu, hoạt động, câu hỏi và đánh giá theo từng giai đoạn.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên. Hãy soạn giáo án chi tiết cho bài [tên bài/môn học] dành cho [lớp/độ tuổi], thời lượng [thời lượng].\n\nGiáo án cần có:\n1. Mục tiêu: kiến thức, kỹ năng và thái độ học sinh cần đạt.\n2. Nội dung chính: kiến thức trọng tâm, khái niệm mới và thông tin bổ sung.\n3. Hoạt động dạy và học theo các giai đoạn: khởi động, hình thành kiến thức, luyện tập và vận dụng; nêu thời lượng, việc của giáo viên, việc của học sinh và học liệu.\n4. Câu hỏi tương tác gợi mở, kích thích tư duy và khuyến khích tham gia.\n5. Phương pháp đánh giá sự tiếp thu: bài tập, kiểm tra nhanh, thảo luận hoặc hình thức phù hợp khác.\n\nBảo đảm logic, phù hợp trình độ và có thể áp dụng trực tiếp. Đối chiếu chương trình/chuẩn đầu ra được cung cấp; nêu giả định và không tự nhận nội dung là yêu cầu chính thức nếu chưa kiểm chứng.",
    "owner": "igen"
  },
  {
    "id": "igen-education-assessment-design",
    "title": "Thiết kế đề kiểm tra và ma trận",
    "description": "Tạo đề trắc nghiệm, tự luận, ma trận và hướng dẫn chấm.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên. Hãy thiết kế đề kiểm tra môn [tên môn] lớp [lớp], gồm câu hỏi trắc nghiệm và tự luận, kèm ma trận đề.\n\nYêu cầu:\n- Bám sát chuẩn kiến thức/yêu cầu cần đạt được cung cấp.\n- Phân bổ nội dung và điểm theo các mức nhận biết, thông hiểu, vận dụng, vận dụng cao.\n- Nêu ma trận theo chủ đề, dạng câu hỏi, mức độ nhận thức, số câu và số điểm.\n- Ghi tỷ lệ phần trăm từng dạng câu hỏi/mức độ, bảo đảm tổng tỷ lệ bằng 100%.\n- Cung cấp đề, đáp án và hướng dẫn chấm rõ ràng cho từng câu.\n\nĐảm bảo câu hỏi chính xác, không mơ hồ và phù hợp độ tuổi. Nêu giả định về thời lượng, thang điểm hoặc chuẩn đầu ra nếu chưa được cung cấp; không gán đề xuất thành chuẩn chính thức.",
    "owner": "igen"
  },
  {
    "id": "igen-education-student-work-review",
    "title": "Chấm và nhận xét bài làm học sinh",
    "description": "Đưa điểm, nhận xét và hướng cải thiện dựa trên tiêu chí rõ ràng.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên. Hãy chấm và nhận xét bài làm của học sinh [mô tả hoặc đính kèm bài], dựa trên mục tiêu môn học [môn học/lớp] và các tiêu chí:\n- Nội dung.\n- Cấu trúc.\n- Ngôn ngữ.\n- Tính sáng tạo.\n\nNêu thang điểm/rubric đang dùng; nếu chưa được cung cấp, đề xuất rubric rõ ràng và ghi đó là giả định. Chỉ ra điểm mạnh, điểm cần cải thiện bằng ví dụ cụ thể trong bài, đưa ra các bước sửa bài thiết thực và dễ áp dụng.\n\nGiữ nhận xét rõ ràng, logic, khích lệ và phù hợp độ tuổi. Không suy đoán năng lực hay tính cách của học sinh ngoài bằng chứng trong bài.",
    "owner": "igen"
  },
  {
    "id": "igen-education-career-guidance",
    "title": "Lập kế hoạch hướng nghiệp",
    "description": "Kết hợp khảo sát sở thích, gợi ý nghề và lộ trình phát triển.",
    "category": "Giáo dục",
    "prompt": "Bạn là chuyên viên tư vấn hướng nghiệp. Hãy xây dựng kế hoạch hướng nghiệp cho [học sinh/lớp] về [chủ đề], gồm:\n1. Câu hỏi khảo sát phù hợp để tìm hiểu sở thích, năng lực, giá trị và cách học của học sinh.\n2. Gợi ý nhóm ngành/nghề phù hợp theo kết quả; giải thích căn cứ và nêu nhiều lựa chọn, không đóng khung học sinh vào một nghề.\n3. Lộ trình học tập với môn trọng tâm, kỹ năng cần phát triển và hoạt động ngoại khóa.\n4. Mốc theo dõi, nguồn thông tin và bước trao đổi tiếp theo với học sinh/gia đình.\n\nĐiều chỉnh theo độ tuổi và môi trường giáo dục. Khi đề cập xu hướng thị trường lao động hiện nay, ghi nguồn và thời điểm; phân biệt dữ liệu với giả định. Không xem khảo sát như chẩn đoán hay quyết định thay cho học sinh.",
    "owner": "igen"
  },
  {
    "id": "igen-education-homeroom-session",
    "title": "Lập kế hoạch sinh hoạt lớp",
    "description": "Tổ chức buổi sinh hoạt theo chủ đề, hoạt động, vai trò và kết quả.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên chủ nhiệm. Hãy lập kế hoạch sinh hoạt cho lớp [lớp] với chủ đề [chủ đề sinh hoạt].\n\nKế hoạch gồm:\n- Mục tiêu và ý nghĩa của chủ đề.\n- Các hoạt động theo trình tự thời gian; nêu phương pháp, thời lượng và công cụ cần thiết.\n- Vai trò, nhiệm vụ của giáo viên chủ nhiệm, học sinh, cán bộ lớp và lực lượng liên quan.\n- Kết quả cụ thể mong đợi sau buổi sinh hoạt.\n- Cách kiểm tra mức độ tham gia và tổng kết.\n\nĐiều chỉnh theo độ tuổi, đặc điểm lớp và điều kiện thực tế. Dùng placeholder cho thông tin chưa có; tránh hoạt động gây xấu hổ, phân biệt hoặc tạo áp lực không cần thiết cho học sinh.",
    "owner": "igen"
  },
  {
    "id": "igen-education-elearning-lesson",
    "title": "Thiết kế bài giảng e-learning",
    "description": "Xây dựng slide, kịch bản video, câu hỏi tương tác và tài liệu.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên. Hãy thiết kế bài giảng e-learning môn [môn học] cho [lớp/trình độ], chủ đề [tên bài], thời lượng [thời lượng].\n\nCung cấp:\n- Dàn ý từng slide: tiêu đề, nội dung chính, gợi ý hình minh họa và ghi chú trình bày.\n- Kịch bản video giảng dạy theo từng đoạn, gồm lời dẫn, hình ảnh/hoạt động và thời lượng.\n- Câu hỏi tương tác: trắc nghiệm, điền chỗ trống và thảo luận, kèm đáp án/phản hồi khi phù hợp.\n- Tài liệu tham khảo và nguồn học liệu.\n- Gợi ý đánh giá và cách hỗ trợ người học cần thêm hướng dẫn.\n\nBảo đảm nội dung logic, dễ hiểu, thu hút, phù hợp độ tuổi và chương trình hiện hành. Nêu nguồn tham khảo có thể kiểm chứng; không bịa tài liệu hoặc chuẩn chương trình.",
    "owner": "igen"
  },
  {
    "id": "igen-education-workshop-plan",
    "title": "Lập kế hoạch hội thảo chuyên đề",
    "description": "Xây dựng mục tiêu, phiên thảo luận, diễn giả và truyền thông.",
    "category": "Giáo dục",
    "prompt": "Bạn là cán bộ đào tạo. Hãy lập kế hoạch tổ chức hội thảo chuyên đề [tên chuyên đề] cho [đối tượng], gồm:\n1. Mục tiêu tổng thể và mục tiêu cụ thể, có thể đánh giá.\n2. Nhóm diễn giả phù hợp, lý do lựa chọn và vai trò; nếu chưa có danh tính, đề xuất hồ sơ/vai trò thay vì bịa tên.\n3. Các phiên thảo luận: chủ đề, mục tiêu, thời lượng, định dạng và người điều phối.\n4. Kế hoạch truyền thông trước, trong và sau sự kiện: kênh, nội dung, quảng bá và tương tác với người tham dự.\n5. Nguồn lực, hậu cần, mốc chuẩn bị và phương án dự phòng.\n\nTrình bày rõ ràng, khả thi và phù hợp mục tiêu chuyên môn. Đánh dấu dữ liệu cần xác nhận như địa điểm, ngân sách và diễn giả.",
    "owner": "igen"
  },
  {
    "id": "igen-education-parent-meeting",
    "title": "Soạn nội dung họp phụ huynh",
    "description": "Chuẩn bị chương trình họp, trao đổi kết quả và phối hợp hỗ trợ học sinh.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên chủ nhiệm lớp [lớp]. Hãy soạn nội dung và chương trình họp phụ huynh, gồm:\n1. Đánh giá kết quả học tập: tiến bộ chung, khó khăn và nội dung cần lưu ý.\n2. Nhận xét về rèn luyện, thái độ học tập và kỷ luật dựa trên thông tin được cung cấp.\n3. Kế hoạch phối hợp giữa giáo viên và phụ huynh để hỗ trợ học sinh trong thời gian tới.\n4. Thời gian hỏi đáp và cách tiếp nhận các vấn đề cần trao đổi riêng.\n5. Lịch trình, thời lượng và tài liệu cần chuẩn bị.\n\nDùng ngôn ngữ rõ ràng, dễ hiểu, phù hợp giáo dục phổ thông. Khi họp nhóm, chỉ trình bày dữ liệu tổng hợp; trao đổi thành tích/khó khăn cá nhân riêng tư với đúng phụ huynh, không tiết lộ thông tin của học sinh khác.",
    "owner": "igen"
  },
  {
    "id": "igen-education-student-competition",
    "title": "Phát động phong trào thi đua",
    "description": "Lập mục tiêu, hoạt động, tiêu chí và cách theo dõi phong trào.",
    "category": "Giáo dục",
    "prompt": "Bạn là cán bộ Đoàn/Đội. Hãy lập kế hoạch phát động phong trào thi đua cho [khối/lớp], gồm:\n1. Mục tiêu và ý nghĩa.\n2. Hoạt động theo từng giai đoạn, người phụ trách và thời hạn.\n3. Tiêu chí đánh giá rõ ràng, đo lường được và cách ghi nhận kết quả.\n4. Cơ cấu khen thưởng vật chất/tinh thần, phù hợp quy định và nguồn lực.\n5. Phương pháp theo dõi, giám sát và báo cáo tiến độ; đề xuất bảng theo dõi/công cụ/họp định kỳ.\n\nKế hoạch cần khả thi, minh bạch, khuyến khích tiến bộ và có cơ hội tham gia công bằng cho mọi học sinh. Nêu giả định về thời gian, nguồn lực hoặc quy định khen thưởng chưa được cung cấp.",
    "owner": "igen"
  },
  {
    "id": "igen-education-supportive-response",
    "title": "Soạn phản hồi tư vấn học sinh",
    "description": "Giải thích, động viên và đưa ra bước tiếp theo phù hợp.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên hoặc cán bộ tư vấn. Hãy viết phản hồi cho [thắc mắc/chủ đề], hướng tới [học sinh/phụ huynh].\n\nPhản hồi cần:\n1. Giải thích vấn đề chi tiết, dễ hiểu và trung thành với ngữ cảnh.\n2. Thể hiện sự động viên, chia sẻ phù hợp với tâm lý và hoàn cảnh.\n3. Đề xuất các bước tiếp theo cụ thể nếu cần.\n4. Giữ giọng thân thiện, chuyên nghiệp và dễ tiếp nhận.\n\nCó thể dùng ví dụ giả định để làm rõ nhưng phải ghi rõ đó là ví dụ, không trình bày như sự thật về người hỏi. Không tự chẩn đoán hoặc đưa ra lời hứa ngoài khả năng hỗ trợ.",
    "owner": "igen"
  },
  {
    "id": "igen-education-extracurricular-program",
    "title": "Thiết kế chương trình ngoại khóa",
    "description": "Lập mục tiêu, lịch trình, phân công và phương án an toàn.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên phụ trách. Hãy thiết kế chương trình ngoại khóa về [chủ đề] cho học sinh [độ tuổi/lớp], gồm:\n- Mục tiêu rõ ràng, đo lường được và phù hợp năng lực.\n- Lịch trình theo từng giai đoạn/buổi: thời gian, địa điểm, hoạt động và người phụ trách.\n- Phân công vai trò cho giáo viên, nhân viên hỗ trợ và học sinh.\n- Lưu ý an toàn sức khỏe, môi trường, di chuyển, quản lý học sinh và phương án khẩn cấp.\n- Vật dụng, kinh phí và thông tin cần xác nhận trước khi tổ chức.\n\nBảo đảm chương trình khả thi với điều kiện nhà trường và có giá trị giáo dục tích cực. Nêu yêu cầu xin phép/đồng thuận và liên hệ khẩn cấp khi phù hợp; không tự giả định địa điểm hoặc phương tiện đã được phê duyệt.",
    "owner": "igen"
  },
  {
    "id": "igen-education-teaching-evaluation",
    "title": "Thiết kế phiếu đánh giá giảng dạy",
    "description": "Đặt tiêu chí, thang điểm và cách tổng hợp phản hồi đa nguồn.",
    "category": "Giáo dục",
    "prompt": "Bạn là cán bộ quản lý. Hãy xây dựng phiếu đánh giá chất lượng giảng dạy cho giáo viên [môn học/lớp], gồm tiêu chí đo lường được về:\n- Nội dung bài giảng.\n- Phương pháp giảng dạy.\n- Tương tác với học sinh.\n- Đánh giá kết quả học tập.\n- Thái độ và tác phong chuyên môn.\n\nNêu thang điểm, mô tả mức điểm cho từng tiêu chí, quy trình lấy ý kiến từ học sinh/đồng nghiệp/phụ huynh khi phù hợp, cách tổng hợp và phân tích kết quả, cùng cách chuyển kết quả thành hỗ trợ/cải tiến giảng dạy.\n\nĐảm bảo tiêu chí liên quan công việc, công bằng và dễ hiểu. Bảo vệ quyền riêng tư; không dùng một nguồn phản hồi đơn lẻ làm kết luận tuyệt đối và nêu rõ giới hạn của dữ liệu.",
    "owner": "igen"
  },
  {
    "id": "igen-education-personalized-study-plan",
    "title": "Lập kế hoạch tư vấn học tập cá nhân",
    "description": "Xác định điểm cần cải thiện, mục tiêu và cách theo dõi tiến bộ.",
    "category": "Giáo dục",
    "prompt": "Bạn là giáo viên [bộ môn/lớp]. Hãy lập kế hoạch tư vấn học tập cá nhân cho học sinh dựa trên [bài làm/kết quả/quan sát đã cung cấp].\n\nKế hoạch gồm:\n- Điểm mạnh và lĩnh vực cần cải thiện, kèm bằng chứng cụ thể.\n- Nguyên nhân có thể có, phân biệt dữ kiện với giả thuyết.\n- Phương pháp khắc phục phù hợp cho từng lĩnh vực.\n- Mục tiêu cải thiện đo lường được, thời hạn và nguồn lực hỗ trợ.\n- Cách theo dõi tiến bộ, tần suất trao đổi và điều chỉnh kế hoạch.\n\nGiữ cấu trúc rõ ràng, khích lệ và thực tế; không gán nhãn học sinh hoặc suy đoán nguyên nhân khi chưa có căn cứ.",
    "owner": "igen"
  },
  {
    "id": "igen-education-school-event",
    "title": "Soạn thông báo và kế hoạch sự kiện trường",
    "description": "Kết hợp thông báo chính thức, lịch trình, phân công và truyền thông.",
    "category": "Giáo dục",
    "prompt": "Bạn là ban giám hiệu. Hãy soạn thông báo và kế hoạch tổ chức sự kiện/sinh hoạt trường về [chủ đề].\n\n1. Thông báo chính thức: mục đích, thời gian, địa điểm, đối tượng tham gia và hình thức tổ chức.\n2. Kế hoạch cụ thể:\n- Lịch trình từ chuẩn bị đến kết thúc, có thời gian cho từng giai đoạn.\n- Phân công nhiệm vụ cho tổ chức, hậu cần, truyền thông, điều phối và các nhóm liên quan, kèm hạn hoàn thành.\n3. Truyền thông: kênh phù hợp như email nội bộ, bảng tin, nhóm trực tuyến và thông báo đầu tuần để tiếp cận giáo viên, học sinh, nhân viên.\n4. Nguồn lực, lưu ý an toàn và phương án dự phòng.\n\nDùng văn phong chính thức, rõ ràng và logic. Để placeholder cho ngày giờ, địa điểm, người phụ trách và thông tin chưa được xác nhận; kiểm tra tính phù hợp với quy định của trường.",
    "owner": "igen"
  }
];

export const initialAssistantPromptFavorites = [
  "igen-marketing-competitor-analysis",
  "igen-marketing-customer-persona",
  "igen-marketing-kpi-plan",
  "igen-marketing-customer-journey"
];
