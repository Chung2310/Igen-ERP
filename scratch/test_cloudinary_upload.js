const BASE_URL = "http://localhost:3000/api/v1";

async function testUploadValidation() {
  console.log("=== Bắt đầu kiểm thử Joi Validation ===");
  try {
    const res = await fetch(`${BASE_URL}/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder: "test",
      }),
    });
    const data = await res.json();
    console.log("Status Code (phải là 400):", res.status);
    console.log("Response JSON:", JSON.stringify(data, null, 2));
    
    if (res.status === 400 && data.message === "Dữ liệu yêu cầu không hợp lệ") {
      console.log("✅ Thành công: Joi Validation phát hiện thiếu trường 'file' và báo lỗi Tiếng Việt.");
    } else {
      console.log("❌ Thất bại: Joi Validation hoạt động không đúng mong đợi.");
    }
  } catch (error) {
    console.error("Lỗi khi gọi API validation:", error);
  }
}

async function testUploadService() {
  console.log("\n=== Bắt đầu kiểm thử Cloudinary Service flow ===");
  try {
    const res = await fetch(`${BASE_URL}/media/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        folder: "igen_erp/test",
      }),
    });
    const data = await res.json();
    console.log("Status Code:", res.status);
    console.log("Response JSON:", JSON.stringify(data, null, 2));

    if (
      res.status === 500 &&
      data.details &&
      (data.details.includes("Cấu hình Cloudinary chưa đầy đủ") || data.details.includes("Must supply api_key") || data.details.includes("Must supply"))
    ) {
      console.log("✅ Thành công: Router, Controller, Service kết nối tốt. Báo lỗi đúng vì cấu hình Cloudinary là các giá trị placeholder.");
    } else if (res.status === 200 && data.status === "success") {
      console.log("✅ Thành công: Tải lên Cloudinary thành công.");
    } else {
      console.log("❌ Thất bại hoặc trạng thái khác mong đợi:", res.status);
    }
  } catch (error) {
    console.error("Lỗi khi gọi API upload:", error);
  }
}

async function run() {
  await testUploadValidation();
  await testUploadService();
}

run();
