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
  }
];

export const initialAssistantPromptFavorites = [
  "igen-marketing-competitor-analysis",
  "igen-marketing-customer-persona",
  "igen-marketing-kpi-plan",
  "igen-marketing-customer-journey"
];
