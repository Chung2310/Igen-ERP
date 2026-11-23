# Phương án P5 model thật — GPT-6 Luna, chờ duyệt

Ngày **21/11/2026**, bản0.2 theo yêu cầu đổi toàn bộ LLM sang GPT-6 Luna. **Ngân sách đang có hiệu lực vẫn0 USD; chưa gọi model thật hoặc làm P6.** [Bản Gemini trước đây](phuong-an-p5-gemini-ban-cu.md) được lưu riêng, không dùng giá đó để duyệt Luna.

## 1. Gói đề nghị

**Đề nghị giữ trần5 USD tiền API cho một vòng, gồm pilot tối đa1 USD nằm trong5 USD.** Một vòng có tối đa24 ca ×2 profile =48 case-runs; các ca pilot được tính trong48, không chạy lại để tăng mẫu.

| Gói | Phạm vi | Trần tiền API |
|---|---|---:|
| A | Pilot3 case-runs, tối đa6 request; dừng để rà usage | 1 USD |
| **B — đề nghị** | Pilot rồi các case-profile còn lại của một vòng | **5 USD tổng** |

Không tự nạp credit, auto top-up hoặc chi phí thẻ/thuế/phí nạp. Nếu chưa có số dư/key riêng phù hợp thì chỉ chuẩn bị. Trần là giới hạn, không cam kết chạy đủ48 lượt; thiếu reserve thì dừng và báo phần chưa chạy.

## 2. Model và giá đã kiểm tra

Model **`openai/gpt-6-luna`**, đề xuất OpenRouter → endpoint OpenAI chuẩn `openai`; không Fast/Flex, không chuyển Bedrock/Azure hoặc model khác trong đợt đánh giá này.

Giá chuẩn hiện tại: **0,10 USD/triệu input;0,50 USD/triệu output**. Metadata có ngưỡng prompt272.000 token: từ ngưỡng đó dùng **0,20 USD/triệu input;0,75 USD/triệu output**. Endpoint công bố context1.050.000, tối đa922.000 prompt token và128.000 completion token. Phải kiểm lại metadata trước chạy. [Trang model/giá](https://openrouter.ai/openai/gpt-6-luna), [metadata endpoint](https://openrouter.ai/api/v1/models/openai/gpt-6-luna/endpoints).

Đề xuất **riêng cho benchmark**: `prompt_cache_options.mode="explicit"` và không có breakpoint để tắt cache tự động, tránh tính thiếu cache-write. Model có cơ chế cache-write riêng; không lấy giá input thường áp cho mọi hóa đơn mặc định. Đây là cấu hình eval cần triển khai/kiểm tra sau duyệt, chưa đổi policy cache của production. [Giải thích cache trên trang model](https://openrouter.ai/openai/gpt-6-luna).

## 3. Dự toán có điều kiện

Dry-run Luna đã kiểm52 test, không gửi thật:24 request narrow;24 discovery +24 interpretation inventory +6 expanded interpretation ở profile rộng. Tổng78 request mô phỏng; trường hợp mọi ca rộng expand thì tối đa96, chưa retry.

Footprint là **20.920.524 bytes JSON body cho corpus hai profile**, body lớn nhất1.456.297 bytes; đây không phải token count. Tokenizer GPT khác Gemini: không chuyển số token Gemini thành số đo GPT. Các số sau chỉ là giả định độ nhạy cho GPT, được đối soát lại bằng pilot:

| Input token giả định/request | Kịch bản thấp | Kịch bản kế hoạch |
|---|---:|---:|
| Narrow | 4.000 | 8.000 |
| Discovery | 70.000 | 140.000 |
| Inventory sau thu hẹp | 25.000 | 50.000 |
| Expanded full catalog | 300.000 | 600.000 |

Tính từng request theo ngưỡng272k; output dự toán4096 token/request. Request full ở cả hai giả định đều vào giá prompt dài, không tính toàn đợt bằng giá0,10/0,50.

| Kịch bản | Requests | Input giả định | Dự toán API, cache tắt |
|---|---:|---:|---:|
| Nhịp dry-run, giả định thấp | 78 | 4.176.000 | **0,76 USD** |
| Nhịp dry-run, giả định kế hoạch | 78 | 8.352.000 | **1,37 USD** |
| Cả24 ca rộng expand, giả định kế hoạch | 96 | 19.152.000 | **3,58 USD** |

Công thức: cộng `input × input_rate/1M + 4096 × output_rate/1M` từng request. **0,76–1,37 USD không phải báo giá chắc chắn hoặc token usage đã đo.** Actual fallback/reasoning/length có thể khác. Không dựa vào cache giảm giá để hứa hoàn tất trong một số tiền cố định. [JSON phép tính, giả định và cap](p5-du-toan-model-that.json).

## 4. Cap và cách giữ trần

| Giới hạn gói B | Đề xuất |
|---|---|
| Tiền API | 5 USD toàn đợt; pilot tối đa1 USD trong tổng này |
| Tổng paid HTTP attempts | 96, gồm lỗi/request đã gửi nhưng kết quả chưa rõ |
| Concurrency /vòng /deadline | 1 /1 vòng /60 phút |
| Output yêu cầu | `max_tokens=4096`; không tự tăng khi bị cắt |
| Tổng input/output usage | 20.000.000 /500.000 token, xét cả đang reserve |
| Native timeout | Discovery20 giây; interpretation40 giây |
| Retry và model/provider fallback | `maxRetries=1`: chỉ1 attempt; không đổi model/provider/FreeLLM |
| Semantic discovery/expanded interpretation | Giữ nguyên, nhưng mọi request sau đều qua cùng ledger |

Không gửi `temperature`: endpoint GPT-6 Luna không hỗ trợ; wire đã được sửa và kiểm offline. Giữ JSON object mode ở main và schema-in-prompt ở discovery; không lén đổi strict schema hoặc thinking policy để cải thiện điểm. Giới hạn output có thể ảnh hưởng visible output/reasoning và phải ghi riêng lỗi length. [Endpoint parameters](https://openrouter.ai/api/v1/models/openai/gpt-6-luna/endpoints), [reasoning accounting](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

Live harness chưa được triển khai. Sau khi được duyệt phải có:

1. Key riêng với lifetime credit limit theo gói, không reset/ngân sách shared production. [Per-key cap](https://openrouter.ai/docs/guides/best-practices/capping-shared-agent-keys).
2. Trước **mỗi native fetch**, reserve **0,30 USD +922.000 input token +128.000 output token**, dựa trần model công bố thay vì đoán tokens từ bytes. Ở giá prompt dài và cache tắt, trần model tương ứng0,2804 USD; làm tròn lên0,30 USD. Dù body xin4096 output, reserve vẫn dùng maximum model.
3. Chỉ gửi nếu `đã đối soát + đang giữ/chưa rõ + reserve mới` nằm trong mọi cap phase/tổng tiền/token/attempt/deadline. Ledger dùng đơn vị tiền nguyên; thiếu giá/metadata thì không gửi. Với cap20M/500k ở giá cao nhất đề xuất, chi phí token là4,375 USD; vẫn kiểm trần tiền5 USD độc lập.
4. Capture raw response gồm usage/cost, generation ID, model/provider, finish reason trước khi wrapper trả text. Chỉ giải phóng reserve dư sau đối soát. Thiếu usage/cost thì giữ reserve và khóa lượt gửi sau, không coi là0. [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting.md).
5. Native AbortSignal phải hủy thật; timeout/cancel giữ reserve và dừng vì chưa biết phí. Khi semantic interpreter catch lỗi và muốn fallback full catalog, latch vẫn chặn gửi mới sau lỗi terminal.
6. Pin `provider.only/order=["openai"]`, `allow_fallbacks=false`, `require_parameters=true`; kiểm cả long-context pricing override, trần giá0,20/0,75 mỗi triệu và không phí/request. Không service tier, tools/web search hoặc cache creation. Không có route đúng thì dừng, không chọn nơi khác. [Routing/price filter](https://openrouter.ai/docs/guides/routing/provider-selection).

Cần test offline toàn bộ gate/usage thiếu/timeout/lỗi sau gửi/expansion khi đã hết tiền trước bật native fetch. Test dry-run52 ca chỉ kiểm plumbing; chưa chứng minh paid guard. Reserve lớn có thể khiến dừng sớm khi chưa tiêu hết5 USD.

## 5. Chạy và chấm sau duyệt

Pilot: S01 narrow, S16 và S21 ở profile rộng, tối đa6 requests. Không ép model chạy expanded giống scripted response; usage từ nhánh thực tế mới là số đo. Với gói B, chỉ tiếp tục khi usage/cost/provider được đối soát đủ, không guard escape hoặc request in-flight, và dự toán cập nhật còn phù hợp cap. Gói A dừng sau pilot.

Dùng24 nhãn S/D1–D5 đã duyệt, lịch sử/pending công khai, metadata2/1.003 workflow; không DB/API nghiệp vụ thật hoặc memory của user. Profile rộng là fixture tổng hợp, không giả là quyền user production. O/F/D6 chưa đưa vào accuracy. S18/S19/S20 full catalog chưa có exact-action mapping: ghi exploratory, không tính sai chỉ vì có action ngoài hai action slice.

Không gửi scripted answer/nhãn vào prompt. Chấm action/field/discovery/clarification, provider/length/JSON errors, attempts, tokens/cost/latency theo từng profile; rà tay câu trả lời tương đương S13/S21/S22. Lỗi hiểu một ca là dữ liệu baseline, không sửa nhãn để tăng điểm. Legacy chưa có V2 evidence nên không báo false UNSOURCED_VALUE như metric runtime đã tồn tại.

Dừng khi không đủ reserve/cap/deadline, mất usage/cost, giá/model/provider ngoài allowlist, request định thoát guard nghiệp vụ/DB, credential/billing error, native timeout/cancel hoặc2 lỗi length/JSON liên tiếp. Không tự retry request chưa rõ kết quả, không tự tăng cap/output hoặc đổi prompt giữa đợt.

Bàn giao real-run report và ledger riêng, phần đã/chưa chạy, source/corpus/model hash và cấu hình đánh giá; không ghi đè dry-run Gemini hoặc Luna. Raw fixture prompt/response đề xuất lưu local7 ngày để rà, không commit credential. Không deploy, bật production, làm P6 hoặc tự chạy vòng tiếp theo.

## 6. Mẫu duyệt

```text
Duyệt gói B: trần5 USD tiền API tổng, pilot tối đa1 USD nằm trong5 USD.
GPT-6 Luna qua OpenRouter/OpenAI chuẩn, fixture24 ca S, hai profile, một vòng.
Chuẩn bị và test live harness/gate rồi chạy trong các cap/stop rule ở tài liệu;
không nạp tiền tự động, không bật production, không sang P6.
```

Nếu chỉ muốn pilot, chọn **gói A: trần1 USD và dừng sau pilot**. Hiện chưa gói nào được duyệt chi tiền, manifest vẫn `liveAllowed=false`, ngân sách hiệu lực0 USD.
