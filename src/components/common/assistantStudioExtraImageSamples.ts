import type { StudioImageRequest } from "./assistantStudioImageApi";

export interface ExtraImageSample {
  id: string;
  label: string;
  accessibleLabel?: string;
  imageUrl: string;
  aspectRatio: StudioImageRequest["aspectRatio"];
  previewRatio: string;
  requiresReference?: boolean;
  prompt: string;
}

export const extraImageSamples: ExtraImageSample[] = [
  {
    id: "igen-national-day",
    label: "Poster quốc khánh",
    accessibleLabel: "Poster quốc khánh",
    imageUrl: "/style-image/sample-igen-national-day.jpg",
    aspectRatio: "3:2",
    previewRatio: "3 / 2",
    prompt: `Tạo poster ngang chào mừng Quốc khánh Việt Nam theo phong cách quảng cáo doanh nghiệp cao cấp. Bố cục như ảnh mẫu: cờ đỏ sao vàng bằng vải tung bay ở một phía, đường chân trời thành phố trong ánh bình minh, nhóm nhân sự mặc trang phục công sở tự tin ở phía còn lại. Dành vùng rõ ràng cho tiêu đề sự kiện, mốc thời gian, khẩu hiệu và logo thương hiệu. Dùng điểm nhấn ánh kim vàng, dải màu ở chân ảnh, ánh sáng điện ảnh và chất ảnh chân thực. Màu đỏ, vàng và màu thương hiệu cân bằng; chữ tiếng Việt dễ đọc. Chỉ viết nội dung, số năm, ngày tháng và đặt logo khi người dùng cung cấp; nếu thiếu thì chừa chỗ phù hợp, không tự bịa thông tin.`,
  },
  {
    id: "ai-video-editor-cover",
    label: "Bài đăng Facebook",
    accessibleLabel: "Bài đăng Facebook hỏi đáp AI",
    imageUrl: "/style-image/sample-ai-video-editor.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo ảnh bìa dọc cho bài đăng mạng xã hội về [chủ đề hoặc tính năng]. Góc chụp từ trên cao bằng ống kính góc rộng: một nhân vật trẻ nhìn thẳng máy ảnh, tương tác với một đạo cụ phù hợp chủ đề, biểu cảm tò mò và thu hút. Nhân vật chiếm nửa dưới ảnh; nửa trên dành cho tiêu đề lớn. Dùng chữ đen kết hợp màu nhấn thương hiệu, làm nổi bật vài từ khóa bằng kiểu chữ nghiêng tự nhiên. Phông nền sáng là mockup giao diện hoặc bối cảnh liên quan chủ đề, có các thẻ nội dung nhỏ ở một bên nhưng không sao chép giao diện thật. Phong cách thumbnail trẻ trung, nhiều khoảng trắng, tương phản cao. Chỉ thêm tiêu đề, tên sản phẩm và logo khi người dùng cung cấp; không tự viết nội dung cụ thể.`,
  },
  {
    id: "top-five-ai-slides",
    label: "Bài đăng Facebook",
    accessibleLabel: "Bài đăng Facebook Top 5 AI tạo slide",
    imageUrl: "/style-image/sample-ai-top-five.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo poster dọc cho bài đăng dạng danh sách “TOP [số lượng] [chủ đề]”. Nền một màu thương hiệu tươi sáng, sạch và tương phản cao. Tiêu đề sans-serif trắng rất lớn chiếm phần lớn nửa trái, chia thành vài dòng; số lượng là điểm nhấn lớn nhất. Bên phải là nhân vật chụp từ góc cao bằng ống kính góc rộng, nhìn thẳng máy ảnh và cầm kính lúp trước một mắt để tạo hiệu ứng phóng đại vui nhộn. Ánh sáng studio sáng, da tự nhiên, bố cục editorial năng động và vài nét tia nhỏ quanh tiêu đề. Chỉ dùng số lượng, chủ đề, chữ và logo được người dùng cung cấp; nếu chưa có thì chừa vùng chữ, không tự chọn một nội dung cụ thể.`,
  },
  {
    id: "igen-erp-voice-ad",
    label: "Bài đăng Facebook",
    accessibleLabel: "Bài đăng Facebook ERP bằng giọng nói",
    imageUrl: "/style-image/sample-igen-voice-erp.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo poster dọc quảng cáo [sản phẩm hoặc dịch vụ] theo phong cách ảnh chụp vui nhộn pha đồ họa. Ở giữa là nhân viên văn phòng đang tương tác với một thiết bị hoặc vật thể liên quan sản phẩm, quay đầu nhìn máy ảnh với vẻ ngạc nhiên. Xung quanh có các thẻ tính năng nổi nhẹ, mỗi thẻ có icon nét đơn giản. Phía trên là headline thật lớn; một nhãn màu tương phản và bong bóng thoại ngắn làm điểm nhấn. Nền sáng, màu thương hiệu kết hợp một màu phụ nổi bật, nhiều thông tin nhưng bố cục vẫn dễ đọc. Chỉ điền tên sản phẩm, tính năng, headline, lời thoại và logo theo nội dung người dùng cung cấp; không tự liệt kê chức năng hoặc tự tạo thông điệp.`,
  },
  {
    id: "igen-free-boss-ad",
    label: "Bài đăng Facebook",
    accessibleLabel: "Bài đăng Facebook người sếp rảnh rỗi",
    imageUrl: "/style-image/sample-igen-free-boss.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo poster dọc cho bài đăng quảng cáo [thương hiệu hoặc thông điệp] theo ý tưởng siêu thực hài hước. Một nhân vật chính ăn mặc công sở ngồi thư thái ở trung tâm, cầm đạo cụ phù hợp thương hiệu, nhìn máy ảnh tự tin. Góc máy hơi thấp làm nhân vật lớn nổi bật; phía dưới là sảnh hoặc không gian làm việc với nhiều người nhỏ như mô hình thu nhỏ, tạo tương phản về quy mô. Chừa vùng trên cho tiêu đề hai cấp: dòng mở đầu nhỏ màu đậm và dòng từ khóa rất lớn bằng màu thương hiệu; thêm vài nét nhấn hình tia. Chất ảnh quảng cáo chân thực, ánh sáng tự nhiên, nền sáng. Chỉ viết thông điệp và đặt logo nếu người dùng cung cấp; không mặc định một ngành nghề hay câu khẩu hiệu cụ thể.`,
  },
  {
    id: "igen-founder-freedom",
    label: "Bài đăng Facebook",
    accessibleLabel: "Bài đăng Facebook tự do của người làm chủ",
    imageUrl: "/style-image/sample-igen-freedom.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo poster dọc truyền cảm hứng cho bài đăng [chủ đề hoặc thông điệp]. Nhân vật chính ở một bên khung hình, mặc trang phục đời thường thanh lịch, ngồi hoặc đứng thư thái trong không gian đô thị hiện đại; chụp từ góc thấp để nhân vật nổi bật và tự tin. Bối cảnh có kiến trúc thành phố, phương tiện hoặc đường dẫn tạo chiều sâu cùng bầu trời rộng, ánh sáng ban ngày, chất ảnh thời trang quảng cáo chân thực. Chừa khoảng trời phía còn lại để đặt câu chữ nhiều cấp, chữ trắng dễ đọc; nhấn một cụm từ khóa bằng màu thương hiệu trên dải nền sáng. Cảm xúc tự do, tích cực và truyền cảm hứng. Chỉ viết câu chữ, tên thương hiệu và đặt logo theo thông tin người dùng cung cấp, không tự thêm thông điệp cụ thể.`,
  },
  {
    id: "tet-holiday-notice",
    label: "Thông báo nghỉ Tết",
    imageUrl: "/style-image/sample-tet-holiday.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo ảnh thông báo lịch nghỉ lễ nhân dịp Tết.

Yêu cầu chi tiết:
- Bố cục: phần trên là tiêu đề “Thông báo lịch nghỉ Tết Nguyên Đán”, phần dưới hiển thị thời gian nghỉ và thời gian làm việc trở lại.
- Chủ thể: biểu tượng đồng hồ, lịch, phong cảnh lễ hội hoặc văn phòng đóng cửa.
- Typography: rõ ràng, dễ đọc, chữ chính nổi bật.
- Màu sắc: hài hòa, tươi sáng theo chủ đề lễ.
- Cảm xúc: lịch sự, chuyên nghiệp, thân thiện.
- Chi tiết phụ: thêm logo công ty và liên hệ hỗ trợ nếu được cung cấp. Không tự bịa ngày nghỉ hoặc thông tin liên hệ.`,
  },
  {
    id: "comic-translation",
    label: "Dịch truyện tranh",
    imageUrl: "/style-image/sample-comic-translation.jpg",
    aspectRatio: "1:1",
    previewRatio: "1 / 1",
    requiresReference: true,
    prompt: `Dịch toàn bộ nội dung truyện trong ảnh đính kèm sang tiếng Anh, giữ nguyên tên các nhân vật, đường nét cốt truyện và ý nghĩa gốc của từng đoạn. Giữ bố cục khung tranh, nhân vật và phong cách minh họa; chỉ thay nội dung chữ bằng bản dịch rõ ràng, tự nhiên.`,
  },
  {
    id: "brand-identity-kit",
    label: "Bộ nhận diện thương hiệu",
    imageUrl: "/style-image/sample-brand-identity.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo bộ hình ảnh nhận diện thương hiệu cho công ty [tên thương hiệu & lĩnh vực hoạt động], bao gồm:
- Logo: tối giản, hiện đại, dễ nhận biết và thể hiện lĩnh vực hoạt động.
- Bảng màu: xác định tông chủ đạo cùng các màu phụ thống nhất, chuyên nghiệp.
- Biểu tượng: icon hoặc yếu tố đồ họa truyền tải thông điệp thương hiệu, theo phong cách tối giản hiện đại.
- Texture: kết cấu hoặc nền mẫu tinh tế, đồng nhất để dùng trong tài liệu truyền thông.
- Mood tổng thể: thể hiện cảm xúc thương hiệu như tin cậy, đổi mới, thân thiện hoặc sang trọng; phản ánh bản sắc và giá trị cốt lõi.
Thiết kế chuyên nghiệp, dễ ứng dụng trên nhiều nền tảng và phù hợp khách hàng mục tiêu.`,
  },
  {
    id: "beauty-video-thumbnail",
    label: "Thumbnail beauty",
    imageUrl: "/style-image/sample-beauty-thumbnail.jpg",
    aspectRatio: "16:9",
    previewRatio: "16 / 9",
    prompt: `Tạo ảnh thumbnail chuyên nghiệp cho video YouTube, TikTok hoặc Reels về chủ đề beauty.
- Gồm một gương mặt hoặc nhân vật có biểu cảm mạnh như ngạc nhiên, vui vẻ hoặc tự tin; nền và vật thể liên quan trực tiếp đến video.
- Màu tươi sáng, tương phản cao, thu hút ngay lập tức.
- Phong cách hiện đại, năng động, thân thiện, tích cực.
- Có thể thêm chi tiết đồ họa nhẹ như viền, mũi tên hoặc biểu tượng.
- Dễ hiểu khi thu nhỏ, truyền đạt rõ nội dung video và phù hợp nền tảng chia sẻ video.`,
  },
  {
    id: "finance-article-thumbnail",
    label: "Ảnh bài báo tài chính",
    imageUrl: "/style-image/sample-finance-news.jpg",
    aspectRatio: "16:9",
    previewRatio: "16 / 9",
    prompt: `Tạo hình thumbnail nổi bật cho bài báo với chủ đề tài chính.
- Bố cục một hình chủ đạo minh họa nội dung bài.
- Chủ thể có thể là nhân vật, bàn làm việc với laptop, biểu đồ hoặc hình trừu tượng liên quan tài chính.
- Phong cách hiện đại, trực quan, phù hợp lĩnh vực tài chính với sắc xanh.
- Ánh sáng tự nhiên, cân bằng hoặc tập trung vào trung tâm.
- Cảm xúc chuyên nghiệp, gợi tò mò, phù hợp môi trường tin tức.
- Có khung viền nhẹ hoặc overlay mờ để chữ nổi bật.`,
  },
  {
    id: "social-product-ad",
    label: "Quảng cáo mạng xã hội",
    imageUrl: "/style-image/sample-social-product.jpg",
    aspectRatio: "1:1",
    previewRatio: "1 / 1",
    prompt: `Tạo hình quảng cáo cho bài đăng mạng xã hội về sản phẩm [tên sản phẩm].
- Kích thước vuông 1:1, phù hợp Facebook Ads và Instagram Feed.
- Tông màu nổi bật, thu hút và làm rõ sản phẩm.
- Nhân vật chính tương tác với sản phẩm tự nhiên, thể hiện tính năng hoặc công dụng.
- Phong cách năng động, tươi mới, gần gũi, tạo thiện cảm.
- Thiết kế trực quan, không rối mắt; sản phẩm là yếu tố trung tâm.`,
  },
  {
    id: "product-packaging",
    label: "Bao bì sản phẩm",
    imageUrl: "/style-image/sample-product-packaging.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo hình ảnh bao bì sản phẩm chuyên nghiệp cho [tên sản phẩm].
- Góc nhìn phối cảnh nghiêng hoặc chính diện trên nền studio sạch.
- Thể hiện rõ chất liệu giấy kraft, nhựa trong, thủy tinh hoặc nhôm với ánh sáng tự nhiên và phản chiếu nhẹ.
- Màu hài hòa với bảng màu thương hiệu; tên sản phẩm và logo nổi bật.
- Bao gồm nhãn dán, họa tiết in nổi hoặc mô tả nhỏ với font dễ đọc, bố cục cân đối.
- Cảm xúc sang trọng, hiện đại, thân thiện.
- Phù hợp brochure, landing page và quảng cáo sản phẩm.`,
  },
  {
    id: "mobile-app-ad",
    label: "Quảng cáo ứng dụng",
    imageUrl: "/style-image/sample-mobile-app.jpg",
    aspectRatio: "16:9",
    previewRatio: "16 / 9",
    prompt: `Tạo ảnh quảng cáo cho ứng dụng di động [tên app].
- Smartphone hiển thị giao diện ứng dụng rõ nét, có tay người dùng tương tác.
- Ánh sáng tập trung ở trung tâm, nền mờ nhẹ, tông xanh/tím/đen hiện đại.
- Thêm icon, đồ họa 3D hoặc biểu tượng sóng dữ liệu, AI và kết nối.
- Typography: slogan ngắn 2–4 từ, sans-serif hiện đại.
- Cảm xúc công nghệ, tiện ích, đột phá; phong cách digital lifestyle.`,
  },
  {
    id: "corporate-report",
    label: "Minh họa báo cáo",
    imageUrl: "/style-image/sample-corporate-report.jpg",
    aspectRatio: "16:9",
    previewRatio: "16 / 9",
    prompt: `Thiết kế hình minh họa doanh nghiệp cho [báo cáo], thể hiện phát triển, thành tựu hoặc đội ngũ nhân viên.
- Phong cách chuyên nghiệp, hiện đại, sử dụng màu thương hiệu.
- Có thể dùng biểu đồ, mũi tên tăng trưởng, hình bắt tay hoặc yếu tố trực quan phù hợp.
- Truyền tải sự tin cậy, bền vững và tích cực.
- Hình rõ ràng, dễ hiểu, dùng được trong môi trường trình bày kinh doanh.`,
  },
  {
    id: "before-after",
    label: "Before – After",
    imageUrl: "/style-image/sample-before-after.jpg",
    aspectRatio: "1:1",
    previewRatio: "1 / 1",
    prompt: `Tạo một ảnh ghép Before – After đặt cạnh nhau, dùng cùng một nhân vật để thể hiện thay đổi sau khi dùng sản phẩm [tên sản phẩm hoặc ảnh đính kèm].
- Before: nhân vật có biểu cảm và trạng thái tiêu cực phù hợp vấn đề sản phẩm giải quyết; bối cảnh, ánh sáng đơn giản, hơi lộn xộn hoặc nhàm chán.
- After: giữ nguyên nhân vật và bối cảnh, thần thái trở nên tích cực, vui vẻ, năng lượng và tự tin; ánh sáng, bối cảnh tươi sáng hơn.
- Hình ảnh hoặc logo sản phẩm xuất hiện tự nhiên, tinh tế trên tay, bàn hoặc thiết bị.
- Tự chọn nhân vật và bối cảnh phù hợp đặc tính sản phẩm; không làm sai lệch hiệu quả thực tế.`,
  },
  {
    id: "ecommerce-product",
    label: "Ảnh sản phẩm eCommerce",
    imageUrl: "/style-image/sample-ecommerce.jpg",
    aspectRatio: "1:1",
    previewRatio: "1 / 1",
    prompt: `Tạo ảnh sản phẩm eCommerce chuyên nghiệp cho [tên sản phẩm].
- Góc chụp chính diện hoặc 45 độ, làm rõ chi tiết và chất liệu.
- Nền trắng tinh khiết hoặc gradient nhẹ xám–xanh nhạt.
- Ánh sáng đều, phản chiếu tinh tế, không có bóng cứng.
- Có thêm góc zoom hoặc cận cảnh chi tiết quan trọng như chất liệu, nút bấm.
- Phong cách clean, minimal, studio lighting.
- Tỷ lệ vuông 1:1 cho Shopee, Lazada, Amazon.`,
  },
  {
    id: "cinematic-portrait-edit",
    label: "Chân dung điện ảnh",
    imageUrl: "/style-image/sample-editorial-portrait.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    requiresReference: true,
    prompt: `Tạo một bức ảnh chân dung thời trang điện ảnh được chỉnh sửa từ ảnh gốc [đính kèm ảnh gốc]. Giữ lại các đặc điểm khuôn mặt chính của người trong ảnh.
- Mặc vest đen, chụp từ góc hơi thấp.
- Ánh sáng vàng ấm chiếu từ bên cạnh, nhấn xương gò má, đường hàm và nét mặt; nửa mặt còn lại mờ vào bóng tối theo hiệu ứng chiaroscuro.
- Biểu cảm tự tin, điềm đạm.
- Nền gradient đỏ đậm tối giản, không khí ấn tượng.
- Siêu chi tiết, photoreal, bố cục dọc, phong cách thời trang biên tập.`,
  },
  {
    id: "product-ad-poster",
    label: "Poster quảng cáo sản phẩm",
    imageUrl: "/style-image/sample-product-poster.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Tạo poster quảng cáo [sản phẩm] gây ấn tượng thị giác mạnh.
- Sản phẩm chính nổi bật ở trung tâm, ánh sáng tập trung.
- Thêm hiệu ứng đồ họa như ánh sáng, giọt nước hoặc khói mờ để tăng hấp dẫn.
- Typography: tiêu đề ngắn gọn, slogan thương hiệu rõ ràng.
- Màu tương phản cao, phù hợp nhận diện thương hiệu.
- Cảm xúc mạnh mẽ, gợi cảm hứng, cao cấp.
- Dùng được cho bài đăng mạng xã hội, banner hoặc billboard.`,
  },
  {
    id: "womens-day",
    label: "Chúc mừng 8/3",
    imageUrl: "/style-image/sample-womens-day.jpg",
    aspectRatio: "3:4",
    previewRatio: "4 / 5",
    prompt: `Thiết kế một ảnh chúc mừng nhân Ngày Quốc tế Phụ nữ 8/3.
- Câu chúc nổi bật ở trung tâm, ví dụ “Happy Women’s Day 8/3” hoặc “Tôn vinh phái đẹp”.
- Kết hợp màu hồng, trắng và vàng, nhẹ nhàng và tinh tế.
- Câu chúc đặt giữa ảnh; logo công ty nhỏ ở một góc nếu được cung cấp.
- Truyền tải sự ấm áp, dịu dàng và tôn vinh phụ nữ.`,
  },
];
