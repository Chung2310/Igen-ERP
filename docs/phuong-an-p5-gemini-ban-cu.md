# Bản lưu: phương án Gemini, đã được thay bằng GPT-6 Luna

Bản này chỉ giữ lịch sử dự toán; chưa từng được duyệt chi tiền. Xem [phương án hiện tại](phuong-an-p5-model-that-va-du-toan.md).

# Phương án P5 với model thật và dự toán để duyệt

Ngày kiểm tra **21/11/2026, giờ Việt Nam**. Phiên bản0.1, **chưa được duyệt chi tiền**. Ngân sách đang có hiệu lực vẫn0 USD. Lượt này chỉ nghiên cứu giá công khai và lập phương án; chưa gọi completion/model thật, chưa tạo key/nạp tiền hoặc làm P6.

## 1. Đề xuất để duyệt

**Đề nghị gói B: trần5 USD tiền API cho một vòng đánh giá.** Chạy pilot tối đa1 USD nằm trong5 USD, đối soát usage rồi mới tiếp tục cùng đợt. Không cộng thành6 USD, không tự chạy vòng2 hoặc nâng trần.

| Gói | Phạm vi | Trần tiền API | Phù hợp khi |
|---|---|---:|---|
| A | Pilot3 case-runs, tối đa6 request model | 1 USD | Muốn lấy token/usage thật trước rồi duyệt phần còn lại |
| **B — đề nghị** | Pilot rồi hoàn tất tối đa24 ca ×2 profile, một vòng | **5 USD tổng** | Muốn có baseline ngôn ngữ đầu tiên với stop rule cứng |

Gói B là quyền chạy **trong giới hạn**, không cam kết hoàn tất48 case-runs bằng mọi giá. Nếu reserve/usage/token/attempt không còn đủ thì dừng và bàn giao phần đã đo. Chưa có đủ dữ liệu để hứa mọi lần chạy đều dưới5 USD.

Trần trên tính theo phí inference đối soát từ `usage.cost`; không tự mua credit, bật auto top-up hoặc chi thêm phí nạp, thuế, tỷ giá/thẻ. Nếu số dư/key phù hợp chưa có, dừng ở bước chuẩn bị và báo phần thiếu. Không dùng chung key của production để đo.

## 2. Model, giá và dữ liệu

Giữ `google/gemini-2.5-flash` để khớp đường đã dry-run. Đề xuất route OpenRouter → endpoint chuẩn `google-ai-studio`, không Flex/Priority, không đổi model. Giá công khai hiện kiểm tra: **0,30 USD/triệu token input;2,50 USD/triệu token output**. Metadata endpoint công bố context1.048.576 token và tối đa65.535 completion token. Đây là giá/model metadata tại ngày lập phương án, phải kiểm tra lại trước khi chạy. [Trang model](https://openrouter.ai/google/gemini-2.5-flash), [metadata endpoint công khai](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints).

Chỉ gửi24 câu S đã duyệt, lịch sử/pending fixture công khai và metadata catalog từ repo. Không gửi DB, lịch sử chat thật, memory cá nhân, tài liệu khách hàng hoặc credential. Dùng profile hẹp2 workflow và profile metadata tổng hợp1.003 workflow như dry-run; profile rộng chưa là quyền của user production. Snapshot/hash input trước chạy; nếu nguồn thay đổi thì ghi version mới, không coi là cùng baseline.

O01–O16/F01–F08/D6 còn mở không đưa vào model accuracy. Theo D3, S18/S19/S20 ở profile rộng chỉ ghi exploratory result; chưa gán exact-action đúng/sai khi chưa rà mapping full catalog. Không gọi API nghiệp vụ, không chạy `processTurn` trên backend thật.

## 3. Căn cứ và phép tính dự toán

[Dry-run](ket-qua-p5-dry-run-tro-ly-erp.md) có24 request narrow; profile rộng có24 discovery +24 interpretation sau thu hẹp +6 expanded interpretation =54. Tổng78 request mô phỏng. Nếu cả24 ca profile rộng đều phải expand, tối đa là **24 +24×3 =96 request** khi không retry.

Footprint thực là JSON body bytes: narrow khoảng19 KB/request; discovery khoảng369 KB; main inventory khoảng120 KB; full fallback lớn nhất khoảng1,46 MB. **Chưa có tokenizer/model usage thật; bytes không phải token count.** Các con số token sau là giả định độ nhạy để chọn ngân sách, không dùng làm reserve trước request.

| Input token giả định/request | Kịch bản thấp | Kịch bản lập kế hoạch |
|---|---:|---:|
| Narrow | 4.000 | 8.000 |
| Discovery | 70.000 | 140.000 |
| Main sau thu hẹp inventory | 25.000 | 50.000 |
| Expanded trên full catalog | 300.000 | 600.000 |

Không quy đổi tự động từ bytes sang tokens. Pilot sẽ xác nhận/thay các giả định bằng usage thật. Không dựa vào cache discount để làm dự toán.

`Tiền API = input_tokens ×0,30/1.000.000 + output_tokens ×2,50/1.000.000`.

Dự toán tính output ở mức4096 token **cho mọi request**, bao gồm thinking/visible output trong giới hạn yêu cầu; đây là cấu hình đề xuất cho lần đo, chưa là usage thực. Tài liệu OpenRouter giải thích reasoning cũng được tính tiền và dùng ngân sách completion; response có thể hết giới hạn trước khi ra JSON. [Reasoning tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

| Kịch bản tính | Requests | Input token giả định | Output theo cap4096/request | Dự toán API |
|---|---:|---:|---:|---:|
| Nhịp dry-run, giả định thấp | 78 | 4.176.000 | 319.488 | **2,05 USD** |
| Nhịp dry-run, giả định kế hoạch | 78 | 8.352.000 | 319.488 | **3,31 USD** |
| Cả24 ca rộng expand, giả định kế hoạch | 96 | 19.152.000 | 393.216 | **6,73 USD** |
| Mọi request dùng hết context công bố, output vẫn cap4096 | 96 | 100.663.296 | 393.216 | **31,18 USD**, không được cấp cho gói B |

Khoảng2,05–3,31 USD **là dự toán có điều kiện**, không phải khoảng chắc chắn. Mốc6,73 USD cho thấy cần dừng theo trần thay vì giả định78 request luôn lặp lại. Số liệu/công thức đầy đủ nằm trong [JSON dự toán](p5-du-toan-gemini-ban-cu.json).

## 4. Cấu hình giới hạn đề xuất

| Giới hạn gói B | Giá trị |
|---|---|
| Tiền inference tổng | 5 USD; phase pilot không quá1 USD trong tổng này |
| Case-runs /số vòng | Tối đa48 /1 vòng, gồm các ca pilot đã chạy; không chạy lại pilot để tăng mẫu |
| Provider HTTP attempts | Tối đa96, tính cả lỗi và request đã gửi nhưng chưa rõ kết quả |
| Concurrent provider requests | 1 |
| Output yêu cầu mỗi request | `max_tokens=4096`; giữ temperature0/JSON mode; không tự tăng khi bị cắt |
| Tổng usage input/output | 12.000.000 /500.000 token; xét cả phần đã dùng và đang reserve |
| Timeout transport | Discovery20 giây, interpretation40 giây; deadline toàn đợt60 phút |
| Retry/model fallback/provider fallback | Không retry; `maxRetries=1` nghĩa là chỉ1 attempt; tắt đổi model/provider và FreeLLM |

Giữ nhánh **semantic discovery fallback/expanded interpretation** để đo đúng logic production, nhưng mỗi request tiếp theo vẫn phải qua cùng budget gate. Tắt retry/fallback provider là khác biệt có chủ đích của cấu hình đánh giá, không sửa đường production; ghi cấu hình này trong kết quả.

Pin cả `provider.only`/`order` tới `google-ai-studio`, `allow_fallbacks=false`, `require_parameters=true`, trần đơn giá input0,30/output2,50 USD mỗi triệu và không chấp nhận phí/request. Không bật service tier, tools, web search hoặc cache creation. Nếu không có endpoint đáp ứng thì dừng; không đổi sang provider đắt hơn. Các cơ chế routing/price filter do OpenRouter hỗ trợ nhưng phải kiểm wire body trong harness mới trước gửi. [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

Giữ reasoning mặc định thay vì thêm một policy thinking mới; cap output có thể làm một số câu trả lỗi length. Báo riêng lỗi cấu hình/length, không tự lặp hoặc nâng cap. Không bật provider strict schema mới trong lần baseline này: giữ main JSON mode và schema-in-prompt của discovery như đã dry-run.

## 5. Cách giữ trần trước khi gửi

Không thể bảo đảm trần bằng cách lấy token trung bình nhân số câu hoặc đợi cuối đợt mới xem hóa đơn. Harness live **chưa được viết trong lượt này** phải có ledger fail-closed tại transport:

1. Dùng key riêng có lifetime credit limit đúng gói được duyệt, không reset định kỳ; không thay ngân sách/key production. OpenRouter có per-key credit limit và budget riêng cho workspace/key; chọn đúng key ownership, không mặc định guardrail cá nhân sẽ áp vào key hệ thống. [Capping shared agent keys](https://openrouter.ai/docs/guides/best-practices/capping-shared-agent-keys).
2. Trước **mỗi native fetch**, giữ tiền0,50 USD, input1.048.576 token và output65.535 token. Dùng mức tối đa model công bố để reserve, không suy token từ bytes. Ở đơn giá đã pin, mức này tương ứng0,4784103 USD; làm tròn lên0,50 USD. Dù body yêu cầu4096 output, reserve vẫn dùng trần model để tránh đánh giá thấp phần chưa biết.
3. Chỉ gửi khi `đã đối soát + chưa rõ/đang giữ + reserve mới` nằm trong cả trần phase/tổng tiền, token, attempts và deadline. Kiểm giá/context/provider trước chạy; metadata thiếu/đổi thì không gửi. Ledger dùng đơn vị tiền nguyên đủ nhỏ, không dựa float làm điều kiện chặn.
4. Bắt raw response trước khi wrapper production bỏ `usage`, generation ID và finish reason; đối soát cost/token thực, sau đó mới giải phóng phần reserve dư. Không có usage/cost đáng tin thì giữ toàn bộ reserve và khóa request tiếp theo; không điền0. Tài liệu hiện cho biết usage được trả trong response Chat Completions, không cần bật tham số include cũ. [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting.md).
5. Native timeout phải abort request thật. Nếu semantic interpreter catch lỗi rồi muốn thử full catalog, latch của ledger vẫn chặn gửi tiếp sau lỗi terminal. Cancel/timeout không chứng minh phí bằng0; giữ reserve và dừng để đối soát, không tự retry request chưa rõ kết quả.

Giới hạn token12M input/500k output ở giá đã pin tương ứng tối đa4,85 USD nếu usage nằm trong các cap. Tiền5 USD vẫn được kiểm độc lập. Reserve lớn có thể làm dừng sớm dù chưa tiêu hết5 USD; đó là hành vi dự kiến, không tự nới cap để chạy cho đủ48 lượt.

Key limit là lớp chặn thứ hai; ledger tuần tự và reserve là lớp chủ động. Không dựa riêng vào số dư toàn tài khoản hoặc key shared. Không có guard hợp lệ/không thể chứng minh giá và số liệu reserve thì chỉ dry-run, chưa gửi thật.

## 6. Thứ tự chạy sau khi được duyệt

**Bước chuẩn bị:** bổ sung live harness riêng, không sửa shared runtime: override retry/fallback/output limit tại seam provider; transport whitelist duy nhất endpoint completion đã duyệt; mọi API nghiệp vụ/DB khác vẫn bị chặn. Gắn AbortSignal và ledger/capture usage vì service hiện chỉ trả text/citations, fetch chưa có signal. Test offline các trường hợp chạm từng cap, thiếu usage, giá sai, cancel, lỗi sau gửi, retry bị chặn và semantic expanded bị chặn khi ledger dừng. Chỉ mở native fetch khi các test đạt; chưa có các kiểm chứng này ở harness dry-run52 test.

**Pilot:** S01 ở narrow; S16 và S21 ở profile rộng, tối đa6 provider requests. Pilot thuộc48 case-runs chung, không nhân thành vòng thứ hai. Dự toán giả định khoảng0,21–0,36 USD theo cap4096; trần pilot vẫn1 USD. S16 có thể không expand nếu model thật trả nhánh khác, không ép model trả scripted output để đạt số call dry-run.

**Cổng tiếp tục gói B:** pilot hoàn tất hoặc đã ghi rõ lỗi từng ca; mọi request có usage/cost/provider/generation ID đối soát được, không guard escape, không còn request in-flight/chi phí chưa rõ. Tính lại dự toán phần còn lại từ usage; nếu khả năng vượt trần hiện rõ, dừng báo mẫu còn thiếu thay vì gửi để thử. Model hiểu sai một ca là dữ liệu baseline cần ghi, không sửa nhãn cho khớp; không đặt ngưỡng accuracy rollout từ3 ca pilot.

**Phần còn lại:** chạy tuần tự các case-profile chưa chạy; giữ đúng corpus hash và lời nói đã duyệt, không đưa nhãn/scripted answer vào prompt. Gói A dừng sau pilot; gói B chỉ tiếp tục trong các cap. Tối đa một đợt60 phút, không có resume tự động sang hôm sau hoặc vòng lặp không người rà.

**Dừng ngay** khi vượt/không còn đủ reserve, mất usage/cost, endpoint/model/giá ngoài allowlist, request định thoát mock nghiệp vụ/DB, abort/timeout, credential/billing error, hoặc2 response length/JSON lỗi liên tiếp cho thấy cấu hình không dùng được. Lỗi phân loại/action/field đơn lẻ được ghi như lỗi model trong phần được chấm, không tự tăng ngân sách hoặc sửa prompt giữa đợt.

## 7. Chấm điểm và bàn giao

Tách narrow và profile rộng; ghi numerator/denominator, discovery candidate/action bị loại, action/field hợp lệ, clarification, provider/length/JSON errors, attempts, tokens, usage.cost, latency và phần chưa chạy. Rà tay đáp án tương đương theo phiếu P4, đặc biệt S13/S21/S22; không chấm bằng so chuỗi duy nhất hoặc từ một lần bấm. Ghi riêng script/server policy khỏi đầu ra model. Ba ca full-catalog chưa có exact label không được tính sai chỉ vì model tìm được action ngoài hai action slice.

Legacy chưa có contract quote/evidence V2: chưa thể báo false `UNSOURCED_VALUE` như metric đã triển khai. Có thể rà giá trị trích sai/người dùng chưa cung cấp; không đổi quote policy trong đợt này. Một vòng24 ca không đủ để nghiệm thu toàn trợ lý hoặc thao tác ghi.

Bàn giao báo cáo real-run riêng với approval/corpus/source/model version, ledger theo request, bảng ca đã chạy/chưa chạy, bảng cost và lỗi đã rà; không ghi đè artifact dry-run. Raw prompt/response fixture đề xuất lưu local7 ngày để rà, không commit credential; báo cáo tổng hợp/hash giữ trong docs. Không gửi thêm dữ liệu ngoài fixture để giải thích lỗi. Không tự chuyển P6, bật flag production hoặc xử lý hồ sơ thật.

## 8. Mẫu duyệt

```text
Duyệt gói B: tối đa5 USD tiền API tổng, pilot tối đa1 USD nằm trong5 USD.
Dùng google/gemini-2.5-flash qua OpenRouter/google-ai-studio chuẩn,
fixture24 ca S đã duyệt, hai profile, một vòng; các cap/stop rule theo tài liệu.
Cho chuẩn bị và kiểm tra live harness riêng rồi chạy trong giới hạn trên;
không nạp tiền tự động, không bật production, không sang P6.
```

Nếu chỉ muốn lấy usage pilot trước, thay gói B bằng **gói A: trần1 USD và dừng sau pilot**. Hiện cả hai phương án đều chưa có hiệu lực chi tiền; cấu hình/manifest vẫn ghi `liveAllowed=false`, ngân sách được duyệt0.
