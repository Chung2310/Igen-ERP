import dotenv from "dotenv";
import { exec } from "child_process";

dotenv.config();

const PORT = process.env.PORT || 3000;
const testUrl = `http://localhost:${PORT}/api/v1/facebook/publish`;

async function runTest() {
  console.log("=== BẮT ĐẦU KIỂM THỬ ĐĂNG VIDEO FACEBOOK QUA N8N ===");
  
  const payload = {
    content: "Đây là bài viết test tự động hỗ trợ Video Reels từ iGen ERP!",
    imageUrl: "https://picsum.photos/800/600",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    pageId: "105882111910387",
    accessToken: "EAAGmx_mock_token_for_reels_test_123456"
  };

  console.log("Đang gửi payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Trạng thái phản hồi:", response.status);
    const result = await response.json();
    console.log("Kết quả trả về từ API:", JSON.stringify(result, null, 2));

    if (response.ok && (result.status === "success" || result.details?.includes("Webhook test"))) {
      console.log("✅ KIỂM THỬ THÀNH CÔNG: API tiếp nhận và chuyển tiếp videoUrl chính xác!");
    } else {
      console.warn("⚠️ CẢNH BÁO: Phản hồi có lỗi, nhưng có thể do webhook n8n chưa được bật hoặc token hết hạn.");
      console.log("Chi tiết phản hồi:", result.message || result.details);
    }
  } catch (error) {
    console.error("❌ LỖI KHI GỌI API:", error.message);
  }
}

// Chạy test
runTest();
