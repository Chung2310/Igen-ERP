import dotenv from "dotenv";
import { facebookPostService } from "../server/service/facebook-post.service";

dotenv.config();

async function runRealTest() {
  console.log("--- BẮT ĐẦU KIỂM THỬ GỬI WEBHOOK SANG N8N ---");
  
  const webhookUrl = process.env.N8N_FB_WEBHOOK_URL;
  const appUrl = process.env.APP_URL;
  
  console.log(`N8N Webhook URL: ${webhookUrl}`);
  console.log(`ERP APP_URL:     ${appUrl}`);

  if (!webhookUrl) {
    console.error("LỖI: N8N_FB_WEBHOOK_URL chưa được thiết lập!");
    process.exit(1);
  }

  try {
    console.log("Đang gửi yêu cầu đăng bài thử nghiệm sang n8n...");
    
    // Sử dụng thông tin giả lập nhưng cấu trúc hợp lệ để n8n tiếp nhận
    const result = await facebookPostService.publishToPage(
      "Nội dung bài đăng thử nghiệm liên kết ERP - n8n mới.", // content
      "", // imageUrl
      "", // videoUrl
      "100083281234567", // mock pageId (định dạng số)
      "mock_access_token_to_n8n", // mock accessToken
      "mock_card_id_123456", // mock cardId
      "immediate", // publishType
      undefined, // scheduledTime
      "Bài đăng Test Kết Nối n8n" // title
    );

    console.log("Kết quả phản hồi từ n8n/service:");
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error("❌ Gặp lỗi khi gửi yêu cầu sang n8n:", error.message);
  }
}

runRealTest();
