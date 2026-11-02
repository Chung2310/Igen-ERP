# Campaign, Message và kho tri thức trong ERP

## Phạm vi

Đưa code từ Marketing `cddce65` vào ERP `d639fd13`. Hai ứng dụng tiếp tục độc lập. Không sao chép `.env`, token, database hoặc dữ liệu người dùng. Danh sách file nguồn và nơi đặt trong ERP nằm tại `tools/marketing-suite/source-manifest.json`.

Phân hệ được gom dưới `src/modules/marketing-suite/` và `server/modules/marketing-suite/`:

```text
marketing-suite/
├── campaign/   # Chiến dịch, Content Sheet, lịch và đăng bài
├── message/    # Message Facebook, CRM và các luồng Inbox
├── knowledge/  # Kho tri thức, tài liệu và FAQ
└── shared/     # Tích hợp, media, adapter và thành phần dùng chung
```

Backend có `router.ts` và `worker.ts` tại gốc phân hệ. `server/workers/marketing-suite.worker.ts` là entry mỏng để giữ các lệnh chạy/deploy hiện tại. Contract dùng chung frontend/backend tiếp tục ở `shared/marketing-suite/`.

Sidebar gom bốn mục **Chiến dịch**, **Message Facebook**, **Kho tri thức**, **Tích hợp & cấu hình** dưới một menu **Marketing** mở/thu gọn. URL, tab ID, mã kích hoạt doanh nghiệp, quyền, collection và queue không đổi. Marketing lễ/tết có sẵn của ERP vẫn là module riêng. Cấu hình doanh nghiệp và quyền người dùng tiếp tục cho phép bật/cấp quyền từng chức năng con.

| Phân hệ | Màn hình | Mã kích hoạt |
| --- | --- | --- |
| Chiến dịch | Planner, Content Sheet, lịch nội dung, duyệt bài, thống kê | `social-marketing` |
| Message | Omni Inbox Facebook/Zalo/TikTok, CRM, AI chat/comment, đơn hàng | `omni-inbox` |
| Kho tri thức | Tài liệu, phạm vi sử dụng, tìm kiếm, xung đột, FAQ | `company-knowledge` |
| Media của Campaign | Tạo ảnh/voice, tải video khách hàng và thiết kế hàng loạt từ bài hoặc chiến dịch | `social-marketing` |

Phạm vi đã chốt: ERP chỉ có Campaign, Message và kho dữ liệu/tri thức. Không có Xưởng nội dung hay Video Studio độc lập; đã gỡ các màn hình/API/worker riêng của OpusClip, motion control, trình chỉnh sửa video, video template, HTML-to-video, video bất động sản và creative-image. Các nút tạo media trong Campaign mở cửa sổ ngay trong chiến dịch, yêu cầu có bài hoặc chiến dịch làm ngữ cảnh.

Giữ tạo ảnh, voice audio, bulk render và phụ đề cho video khách hàng cung cấp. Campaign không có HeyGen/avatar hoặc tạo video OpenRouter; video phải được tải lên hoặc nhập từ Drive. Bài thiếu video chuyển sang chờ bổ sung media, không tự tạo video hoặc thay bằng ảnh. Các lệnh Telegram tạm để nguyên; dịch vụ video nội bộ còn phục vụ phần đó và không được nối vào Campaign. `files` trong manifest là 309 ánh xạ còn dùng; `excludedStandaloneTools` ghi 166 file đã loại khỏi bản port.

AI Marketing dùng `OPENROUTER_API_KEY`. ENV mẫu dùng `OPENROUTER_TEXT_MODEL`, `OPENROUTER_HEAVY_MODEL`, `OPENROUTER_IMAGE_MODEL` và `OPENROUTER_FALLBACK_MODEL` (fallback text). Tên model `google/gemini-*` vẫn gọi qua OpenRouter. Các tên ENV model cũ `GEMINI_MODEL`, `GEMINI_HEAVY_MODEL`, `FALLBACK_MODEL` còn được đọc để tương thích cấu hình đã có, không cần key Google riêng.

Đã loại API phân tích phong cách video mẫu, nhánh Gemini Files API/blueprint/edit-script, client Gemini trực tiếp và dependency SDK tương ứng. Các hàm client/controller của trình sửa video không còn được gọi cũng đã gỡ. Các URL `/gemini/*` còn lại là tên API nội bộ cũ cho luồng OpenRouter; giữ tên để các chức năng Campaign/Message đang dùng không bị đổi hợp đồng.

Đợt dọn tiếp theo loại API/helper master-prompt và compose HTML-video, các hàm client FreeLLM/voice cũ, PiAPI và log key, Hermes editor/lệnh Telegram/callback, Shotstack cùng model render/template, và Copywriter agent cũ đã được thay bằng CandidateSelectionService. Voice Campaign tiếp tục dùng API ElevenLabs riêng. Helper điều hướng Studio chỉ còn chuyển ngữ cảnh bài/chiến dịch sang cửa sổ media; đã bỏ URL và sessionStorage của trang công cụ cũ.

Đã gỡ helper đọc bố cục ảnh tham chiếu của bộ tối ưu prompt video cùng nhánh tạo video Campaign. Một số tên model alias và metadata PiAPI/Hermes cũ còn được giữ để đọc dữ liệu lịch sử; không nạp hoặc gọi các provider đã gỡ.

Đã dọn bảng giá/usage stub frontend không còn được gọi; helper chỉ giữ định dạng tên model và ước lượng thời lượng audio mà Campaign đang dùng. Thông báo Telegram dùng tên trợ lý AI chung, tài liệu không hướng dẫn dùng HyperFrames. Đã xóa thêm 127 thư mục package thừa, 20 launcher và cache Vite/Yarn cũ trong `node_modules` (khoảng 343 MiB), đồng thời loại 211 mục lockfile không còn được tham chiếu. Sharp 0.35.3, FFmpeg, Remotion Renderer và các dependency được ERP gọi trực tiếp vẫn được giữ; một số package như Prettier còn được Google APIs dùng nội bộ nên không xóa theo cây khai báo đơn thuần. `google-auth-library` được khai báo trực tiếp với phiên bản 10.6.2 có sẵn trong cây Google APIs của ERP vì dịch vụ Google Drive/OAuth hiện tại import package này.

## Những xung đột đã xử lý

1. ERP có sẵn model `MarketingCampaign` phục vụ chiến dịch lễ/tết. Planner mới dùng model `SocialMarketingCampaign`, collection `social_marketing_campaigns`. Các liên kết slot/candidate/content trỏ về model mới.
2. Giữ đăng nhập, phiên truy cập, phân quyền, Company/User và Socket.IO của ERP. Adapter dùng phiên ERP; không tạo AuthProvider thứ hai.
3. Giữ phân hệ Marketing lễ/tết của ERP. Ba phân hệ mới phải được bật rõ ràng trong cấu hình doanh nghiệp và có quyền tương ứng.
4. Không thay thế kho tài nguyên của ERP. AI Knowledge document/chunk/FAQ riêng; đồng bộ Drive cập nhật tài liệu nguồn và không mặc định xóa kho tri thức.
5. API CRUD riêng chỉ cho các collection của phân hệ; thao tác danh sách/chi tiết/tạo/sửa/xóa đều lấy công ty từ phiên ERP. API media/wallet được đặt tên riêng để tránh đè route ERP.
6. Account socket room có công ty + kênh + tài khoản, được kiểm tra quyền trước khi tham gia. Webhook không xử lý khi doanh nghiệp đã tắt Omni Inbox. Từ chối tài khoản có chủ sở hữu mâu thuẫn giữa các doanh nghiệp.
7. Queue sử dụng `MARKETING_QUEUE_PREFIX`, tách khỏi Marketing độc lập. Worker có entry riêng, không khởi chạy follow-up khi API chỉ import service. Sự kiện worker chuyển về API qua Redis.
8. Token tích hợp công ty được mã hóa bằng cơ chế ERP. API danh sách không trả token; nút copy token dùng API có quyền manage và ghi audit. TikTok token chỉ sử dụng tại server.
9. Facebook OAuth có phiên lưu tại server, TTL, cookie, state ký và dùng một lần. TikTok dùng khóa state riêng mục đích và kiểm tra lại người dùng/quyền/phân hệ khi callback.
10. Approval link và callback dùng `APP_URL` của ERP. Secret worker/n8n bắt buộc; không có khóa mặc định dùng chung với Marketing. Không mặc định gửi video tới VPS của ứng dụng nguồn.
11. Campaign tải video trực tiếp qua `/marketing-media/campaign-sign-upload`, kiểm tra metadata và ký folder theo công ty/người dùng. Không phụ thuộc API của Video Editor đã gỡ. Tải ảnh thành phẩm gửi Bearer token bằng fetch trước khi tạo link blob.
12. Campaign, Inbox và Kho tri thức đọc tài khoản qua API `accounts` trong phân hệ tương ứng, chỉ lấy metadata cần dùng. Inbox lưu AI config qua `/omni-inbox/accounts/:id/ai-config`, không được sửa token hay định danh tài khoản. Quản lý credential vẫn cần `social-integration:manage`; các route validate/OAuth không yêu cầu thêm quyền đăng bài.
13. Khi lên lịch hoặc đăng Facebook, server xác định bài và tác giả trong cùng công ty, dùng đúng tài khoản đã chọn và từ chối Page không khớp. Không thay Page của tác giả bằng Page của người thao tác.
14. ElevenLabs API key và token/state Canva mới được loại khỏi projection mặc định và serialization User của ERP. Các dịch vụ nội bộ chọn rõ trường bí mật cần dùng. Kho tri thức dùng quyền ERP `company-knowledge:manage` cho cả giao diện và API.
15. Cấu hình SePay và catalog sản phẩm dùng `social-integration:manage`, bỏ ràng buộc vai trò admin cũ; nút sửa SePay dựa trên quyền thực tế trong phiên ERP. Inbox chỉ coi kênh có kết nối khi có tài khoản hợp lệ, xóa lựa chọn Zalo/TikTok không còn tồn tại và dừng polling/xóa hội thoại cũ khi hết kết nối. Đã bỏ hàm client cập nhật doanh nghiệp không còn nơi gọi và không có API tương ứng. ENV mẫu chỉ giữ key ElevenLabs tùy chọn cho voice audio của Campaign. Phần liên kết/cấu hình Telegram được giữ nguyên trong đợt sửa này.
16. PDF upload dùng đúng tham số `data` của pdf-parse và giải phóng parser sau khi đọc. Hai API `/gemini/upload-document` và `/gemini/extract-scenario` được nhận body file lớn theo giới hạn có sẵn. Kịch bản riêng của Inbox dùng API trích xuất với quyền `omni-inbox:manage`; API này buộc `extractOnly=true` và không ghi kho tri thức, còn nạp tài liệu chung vẫn yêu cầu `company-knowledge:manage`. Upload relay trong `/marketing-media` tự xác định folder theo công ty/người dùng, không dùng folder client gửi; đã gỡ `/marketing-media/sign-upload` cũ, giữ `/marketing-media/campaign-sign-upload` có kiểm tra metadata.
17. Video Campaign chỉ dùng file khách hàng: gỡ avatar/HeyGen, callback, API key, thư viện và tạo video AI trong Campaign; không tính chi phí tạo video trong dự toán. Slot video mới dùng upload/Drive; worker đưa slot thiếu file về awaiting_assets, vẫn giữ kiểm tra media, phụ đề và duyệt TikTok. Giá trị human-video trong dữ liệu cũ chỉ được đọc như video thông thường; không có đường tạo avatar mới.

18. API nội dung kiểm tra campaign/slot cùng công ty và khóa việc đổi liên kết của bài đã gắn slot. Card và Order nhận media qua cùng helper ERP: lưu nguồn, xóa cache/caption cũ, chuyển slot chờ media sang worker và yêu cầu duyệt lại; autosave brief Order không khởi động lại media. Retry caption tái gắn URL/project đã render về nội dung. Facebook lưu trạng thái tại server bằng cập nhật có điều kiện, không tự tạo Post ID từ acknowledgement; callback trùng/muộn không làm lùi trạng thái đã đăng, chỉ cập nhật slot cùng công ty và đúng liên kết nội dung. Giao diện đọc lại card từ server trước khi báo kết quả; tài khoản demo không ghi bài đăng thật.

Các quyền mới: `omni-inbox:read/manage`, `company-knowledge:read/manage`, `social-integration:read/manage`. Chiến dịch dùng `marketing:read/manage` hiện có. Scope của các phân hệ này là doanh nghiệp; không suy diễn quyền theo chi nhánh của những phân hệ ERP khác.

## Luồng chiến dịch

Tạo chiến dịch lưu chiến lược và slot brief. Worker chuẩn bị nội dung tạo mặc định 3 phương án, tối đa 5, chạy tối đa 2 tác vụ AI song song. Kiểm tra dữ liệu bắt buộc, định dạng nền tảng, CTA/hashtag, từ cấm và trùng nội dung trước khi chấm điểm. Lưu điểm thật theo 7 tiêu chí, chọn phương án đạt ngưỡng; trường hợp hết lượt chuyển `needs_attention`.

Candidate giữ fingerprint đầu vào và trạng thái đánh giá. Phí generate/score có reservation và idempotency key riêng. Nếu một tác vụ đã có bút toán nhưng chưa có kết quả lưu được thì dừng để đối soát thay vì gọi lại provider tự động. Các bước media, verify, publish tiếp tục dùng lease và kiểm tra readiness của pipeline nguồn.

## Chạy code sau khi cấu hình

1. Cài dependency đúng lockfile: `yarn install --frozen-lockfile`.
2. Bật các mã phân hệ cần dùng trong cấu hình doanh nghiệp, cấp quyền cho vai trò. Nếu doanh nghiệp có RolePermission tự cấu hình thì bổ sung quyền ở cấu hình đó.
3. Cấu hình `APP_URL` trỏ ERP, Redis và tiền tố queue duy nhất. Giữ MongoDB của ERP hiện có. Không sao chép cấu hình DB/token từ Marketing.
4. Cấu hình provider thực sự sử dụng. Facebook/n8n dùng `N8N_FB_WEBHOOK_URL`; `N8N_CAMPAIGN_FB_WEBHOOK_URL` là tùy chọn ghi đè cho chiến dịch. `SUPERADMIN_ENCRYPTION_KEY` phải giữ ổn định; mất khóa sẽ không đọc được token đã mã hóa.
5. `npm run build` tạo frontend, API và `dist-server/marketing-worker.cjs`.
6. API: `npm start`. Worker: đặt `MARKETING_WORKERS_ENABLED=true`, chạy `npm run start:marketing-worker`. Có thể chọn role `campaign`, `inbox`, `media` hoặc `all`.
7. Docker Compose có profile tùy chọn: `docker compose --profile marketing up -d`. Redis phải sẵn có trên mạng đã cấu hình; profile này không tạo hay cấu hình lại Redis.
8. Chỉ chạy một worker role inbox có follow-up/polling cho mỗi môi trường. Telegram polling mặc định tắt; chỉ bật `MARKETING_TELEGRAM_POLLING_ENABLED=true` với bot riêng của ERP.
9. Đăng ký callback/webhook ERP tại các provider. Không chuyển webhook đang phục vụ Marketing sang ERP trong đợt sao chép code này.

FFmpeg và Chromium cần có cho bulk render và phụ đề Campaign. Dockerfile bổ sung các binary và prompt assets; bulk dùng `@remotion/renderer`. Runtime HyperFrames và `@remotion/bundler` của trình sửa video đã được loại sau khi kiểm chứng không còn được bundle API/worker sử dụng. Thư mục cài Gemini SDK, HyperFrames, bundler và hai ZIP sao lưu dọn công cụ đã được xóa khỏi `node_modules` của ERP (khoảng 86 MiB). Video provider, callback và publish cần cấu hình thực tế trước khi sử dụng.

## Kiểm tra và giới hạn

Kiểm tra contract tại `server/modules/marketing-suite/shared/port-contract.test.ts`: candidate count/score/validation, model không đè ERP cũ, mã hóa token, route nội bộ và khóa khác mục đích, Drive export và giới hạn folder. Ca kiểm tra client Gemini cũ đã được loại cùng client.

Lệnh: `node node_modules/vitest/vitest.mjs run server/modules/marketing-suite/shared/port-contract.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`.

Các test hồi quy bổ sung: `server/modules/marketing-suite/shared/{access,media-download}.test.ts`, `src/modules/marketing-suite/shared/context/AuthContext.test.tsx`, `src/modules/marketing-suite/shared/components/settings/CompanyIntegrationsTab.test.tsx`, `src/modules/marketing-suite/campaign/services/marketingService.publish.test.ts`. Bao phủ profile ổn định qua render, quyền cấu hình AI theo Inbox, URL tải file và chuyển hướng, chỉnh sửa tích hợp khi token bị ẩn, và đăng Facebook chỉ gửi Page ID để server lấy token.

Các test sửa luồng sau khi gỡ công cụ media độc lập: `server/modules/marketing-suite/shared/{account-access,feature-permissions,campaign-media-upload,user-secrets}.test.ts` và `src/modules/marketing-suite/shared/services/{mediaDownloadService,videoProjectMediaService}.test.ts`. Bao phủ metadata theo công ty, giới hạn cập nhật AI config, quyền route, hợp đồng ký upload, projection/serialization bí mật, upload video Campaign và tải ảnh có xác thực. Test access bổ sung trường hợp lên lịch thay tác giả, Page không khớp, tích hợp ngắt kết nối và bài không thuộc công ty.

Các lệnh build/typecheck và import smoke không chứng minh provider sẽ đăng bài, nhận webhook hoặc render video thật thành công. Chưa dùng tài khoản provider, chưa gửi tin/đăng bài, chưa render tính phí, chưa chạy Docker hoặc load test với MongoDB/Redis thực tế. Những trường hợp mất kết nối giữa cập nhật ví và lưu kết quả cần đối soát bút toán trước khi retry.

Một số file nguồn có sẵn chuỗi tiếng Việt hỏng encoding; danh sách U+FFFD nằm trong manifest. Không sửa file nguồn Marketing trong đợt port này. Khi phục hồi các chuỗi đó cần đối chiếu bản UTF-8 gốc, không chuyển mã toàn bộ repository.

Chuyển dữ liệu thực tế được thực hiện riêng sau theo yêu cầu của chủ dự án.

Webhook Zalo yêu cầu `ZALO_APP_ID` và `ZALO_OA_SECRET_KEY` đúng của ERP; xác thực raw JSON theo [tài liệu Zalo OA](https://stc-developers.zdn.vn/docs/v2/official-account/webhook/quan-ly/su-kien-tao-nhan). TikTok Messenger sử dụng verifier chữ ký của TikTok chung với publish callback. Không chấp nhận payload khi thiếu cấu hình xác thực.

Các kỳ vọng cũ về quyền `asset` đã được cập nhật trong `src/config/modules.test.ts` và `server/config/permission-catalog-cleanup.test.ts`; test access không còn yêu cầu endpoint media-providers đã gỡ. Logic quyền Tài chính giữ nguyên.

## Sửa lỗi sau rà soát toàn bộ

- Link duyệt công khai giới hạn thao tác trong ngày/khoảng ngày đã ký, theo múi giờ Campaign. Duyệt/từ chối dùng cập nhật có điều kiện theo trạng thái, phiên bản thời gian và lease; sửa nội dung giữ lease và tạo đủ trường bắt buộc, liên kết content với slot.
- Facebook comment dùng khóa cục bộ có chủ sở hữu và collection `FacebookCommentDelivery` với unique index `(companyCode, pageId, commentId)`. Đánh dấu bắt đầu gửi trước Graph API; kết quả gửi không xác định phải đối soát, không tự gửi lại. Cần bảo đảm index này được tạo khi triển khai, trước khi mở webhook cho nhiều tiến trình API.
- Job AI Sheet/Order trả lease khi lỗi, giữ kết quả đã lưu và chặn worker cũ ghi kết thúc thay worker mới. Có heartbeat, giới hạn ba lần chạy tự động và phục hồi cả job queued trong DB. Bốn queue Sheet/Order/Bulk/Caption quét phục hồi mỗi 30 giây, kể cả sau khi worker đã khởi động.
- Bulk import ảnh dùng cùng helper lưu media có lease, kiểm tra timestamp đã đọc và đồng bộ content; từ chối slot đang xử lý hoặc dùng video. Thêm dòng Sheet kiểm tra khoảng ngày, quy tắc video TikTok và nguồn media.
- Caption cấp `versionSequence` riêng cho mỗi lượt ghi, lưu đủ segments trước khi đổi `currentVersion`. Counter tự khởi tạo từ phiên bản hiện có; không cần backfill dữ liệu. Lượt thua conflict chỉ dọn phiên bản của mình; lỗi không xác định lúc commit giữ batch ẩn để tránh xóa dữ liệu đã được ghi.
- Thư viện ảnh dùng cache theo doanh nghiệp và tài khoản, bỏ cache chung cũ; workspace được tạo lại khi đổi tài khoản. Analytics lọc ngày và nhóm ngày theo timezone của Campaign, cộng bút toán payment/success gắn slot cho research, vision, toàn bộ candidate, ảnh và Sheet AI. Khoản pending/failed không tính; dữ liệu cũ chưa có bút toán gắn slot dùng research/vision làm fallback. Báo cáo dùng đơn vị Credit; dữ liệu cũ cần được đối chiếu riêng khi chuyển dữ liệu sau này.

Các ca mô phỏng trạng thái/race chạy trong bộ nhớ, không truy cập MongoDB/Redis hoặc provider. Chưa xác minh unique index, query plan của Analytics, phục hồi queue và gửi/render thực tế trên môi trường triển khai.

### Sửa xung đột chỉnh sửa và khôi phục tác vụ

- Chỉnh nội dung nội bộ, API bài đăng dùng chung và Sheet dùng lease slot cùng transaction cho row, content, slot và lịch sử. Khi sửa nội dung cuối, slot về `pending_approval` và bỏ thông tin duyệt cũ. Duyệt/từ chối kiểm tra timestamp đã đọc; worker không nhận slot đang có lease chỉnh sửa. Sửa đồng thời nội dung và media dùng chính lease của lượt media.
- Sheet giữ nguyên khóa cột hệ thống (`bodyText`, `mediaSource`, `scheduledAt`...), chỉ chuẩn hóa tên cột tùy chỉnh. Áp dụng AI giữ lease riêng, lưu trạng thái `applied` cho từng trường và nhận diện row đã ghi qua `generationId`. Chọn một phần không đóng phần còn lại; lỗi trả về số dòng thất bại. Lượt `applying` hết lease trở về `partial` để người dùng tiếp tục duyệt. Hoàn tác lưu biên nhận theo dòng và chỉ đóng lượt khi mọi dòng hoàn tất.
- Bulk item có `lockId` tùy chọn, được gán khi worker nhận dòng. Tiếp quản job phục hồi cả dòng đang xử lý; worker cũ không ghi đè kết quả lượt mới. Mỗi lượt upload dùng tên asset riêng. Hủy job đánh dấu cả dòng queued và processing.
- Caption kiểm tra số lần thử ngay lúc nhận job và lúc phục hồi, giữ yêu cầu hủy và yêu cầu STT đang chờ provider. Callback lỗi mang attempt/lockId của lượt chạy; chỉ cập nhật project khi job đó vẫn là job mới nhất và project chưa hoàn tất.
- Facebook kiểm tra lại chủ sở hữu, tạm dừng AI, tin khách mới nhất và lease ngay trước Graph API cho tin chữ lẫn ảnh. Nhân viên gửi thủ công sẽ lưu trạng thái tạm dừng trước khi gọi provider. FAQ từ phiên cũ không thể ghi đè quyết định duyệt/từ chối mới.
- Hoàn Credit ghi trạng thái giao dịch và số dư trong cùng transaction; bước hoàn lỗi giữ giao dịch pending để thử lại.

**Điều kiện MongoDB:** các thao tác lưu nhiều bản ghi và hoàn Credit trên cần replica set hoặc sharded cluster có hỗ trợ transaction. Không triển khai trên MongoDB standalone. Chưa kiểm tra topology/transaction bằng kết nối DB thật trong đợt sửa này. Các trường `BulkRenderItem.lockId` và trạng thái áp dụng từng trường AI được khởi tạo khi sử dụng, không cần backfill.

ENV ERP đã bỏ các khóa Gemini API, HeyGen, PiAPI/Kling, Remotion/Hermes/Claude render cũ và `SEEPAY_WEBHOOK_URL` không có consumer. Model text/heavy dùng `OPENROUTER_TEXT_MODEL`/`OPENROUTER_HEAVY_MODEL`. Giữ cấu hình ERP hiện có cho PayOS, Google Drive, FreeLLM và các kênh đang tạm hoãn vì code vẫn tham chiếu. Telegram tiếp tục được xử lý ở đợt riêng.
