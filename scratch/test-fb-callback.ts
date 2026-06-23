import dotenv from "dotenv";
import mongoose from "mongoose";
import { MarketingContentModel } from "../server/model/marketing-content.model";
import { facebookPostController } from "../server/controller/facebook-post.controller";

dotenv.config();

async function runTest() {
  console.log("--- BẮT ĐẦU KIỂM THỬ CALLBACK FACEBOOK N8N ---");
  
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error("LỖI: MONGODB_URI không tồn tại trong file .env!");
    process.exit(1);
  }

  console.log("1. Đang kết nối tới MongoDB...");
  await mongoose.connect(dbUri);
  console.log("   Kết nối MongoDB thành công!");

  try {
    console.log("2. Khởi tạo dữ liệu giả lập cho bài đăng (approved)...");
    const testCard = await MarketingContentModel.create({
      title: "Bài đăng Test n8n Callback",
      channel: "Facebook",
      contentType: "Bài viết thương hiệu",
      status: "approved",
      bodyText: "Nội dung đăng tải thử nghiệm qua n8n webhook callback.",
      companyCode: "IGEN",
      generatedAt: new Date()
    });
    const cardId = testCard._id.toString();
    console.log(`   Tạo Card thành công! ID: ${cardId}`);

    console.log("3. Giả lập gọi receiveN8nCallback...");
    const mockReq = {
      headers: {},
      body: {
        cardId: cardId,
        postId: "fb_post_test_987654321",
        postUrl: "https://www.facebook.com/1097127063485732/posts/987654321/"
      }
    } as any;

    let responseCode = 0;
    let responseData: any = null;

    const mockRes = {
      status: (code: number) => {
        responseCode = code;
        return {
          json: (data: any) => {
            responseData = data;
          }
        };
      }
    } as any;

    await facebookPostController.receiveN8nCallback(mockReq, mockRes);
    console.log(`   Phản hồi từ Controller: HTTP ${responseCode}`, responseData);

    console.log("4. Kiểm tra lại dữ liệu trong Database...");
    const updatedCard = await MarketingContentModel.findById(cardId);
    if (!updatedCard) {
      throw new Error("Không tìm thấy Card sau khi callback!");
    }

    console.log("   Trạng thái hiện tại:", updatedCard.status);
    console.log("   facebookPostId:", updatedCard.facebookPostId);
    console.log("   postUrl:", updatedCard.postUrl);
    console.log("   publishError:", updatedCard.publishError);

    // Đối soát kết quả
    if (
      updatedCard.status === "published" &&
      updatedCard.facebookPostId === "fb_post_test_987654321" &&
      updatedCard.postUrl === "https://www.facebook.com/1097127063485732/posts/987654321/" &&
      updatedCard.publishError === undefined
    ) {
      console.log("✅ KẾT QUẢ: KIỂM THỬ THÀNH CÔNG RỰC RỠ! Dữ liệu khớp 100%.");
    } else {
      console.error("❌ KẾT QUẢ: THẤT BẠI! Dữ liệu không khớp.");
    }

    console.log("5. Đang dọn dẹp dữ liệu test...");
    await MarketingContentModel.findByIdAndDelete(cardId);
    console.log("   Dọn dẹp thành công.");

  } catch (error: any) {
    console.error("❌ Gặp lỗi trong quá trình chạy test:", error.message);
  } finally {
    console.log("6. Đang ngắt kết nối MongoDB...");
    await mongoose.disconnect();
    console.log("   Hoàn tất.");
  }
}

runTest();
