const BASE_URL = "http://localhost:3000/api/v1";

// Một email ngẫu nhiên để tránh lỗi trùng lặp khi chạy đi chạy lại
const email = `test_${Date.now()}@igen.com`;
const password = "password123";
const displayName = "Nguyễn Văn Test";

let accessToken = "";
let cookieHeader = ""; // Lưu trữ cookie để giả lập phiên của trình duyệt

async function testRegister() {
  console.log("=== 1. Đăng ký tài khoản ===");
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName,
        companyCode: "COMP_TEST",
        companyName: "Công ty Test",
      }),
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (res.status === 201 && data.status === "success") {
      console.log("✅ Đăng ký thành công.");
    } else {
      console.log("❌ Đăng ký thất bại.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    process.exit(1);
  }
}

async function testLogin() {
  console.log("\n=== 2. Đăng nhập ===");
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    // Lấy cookie refreshToken
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      cookieHeader = setCookie.split(";")[0]; // dạng "refreshToken=..."
      console.log("Nhận được Cookie:", cookieHeader);
    }

    if (res.status === 200 && data.accessToken) {
      accessToken = data.accessToken;
      console.log("✅ Đăng nhập thành công. Nhận được AccessToken.");
    } else {
      console.log("❌ Đăng nhập thất bại.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    process.exit(1);
  }
}

async function testGetMe() {
  console.log("\n=== 3. Lấy thông tin cá nhân (GET /me) ===");
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (res.status === 200 && data.user && data.user.email === email) {
      console.log("✅ Xác thực thành công. Đọc đúng thông tin /me.");
    } else {
      console.log("❌ Lấy thông tin thất bại.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Lỗi xác thực /me:", error);
    process.exit(1);
  }
}

async function testRefreshToken() {
  console.log("\n=== 4. Làm mới mã truy cập (Refresh Token) ===");
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookieHeader, // Giả lập gửi cookie từ client
      },
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (res.status === 200 && data.accessToken) {
      console.log("✅ Làm mới Token thành công.");
    } else {
      console.log("❌ Làm mới Token thất bại.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Lỗi làm mới token:", error);
    process.exit(1);
  }
}

async function testLogout() {
  console.log("\n=== 5. Đăng xuất ===");
  try {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Cookie": cookieHeader,
      },
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (res.status === 200) {
      console.log("✅ Đăng xuất thành công. Đã xóa cookie.");
    } else {
      console.log("❌ Đăng xuất thất bại.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
    process.exit(1);
  }
}

async function run() {
  await testRegister();
  await testLogin();
  await testGetMe();
  await testRefreshToken();
  await testLogout();
  console.log("\n🎉 HOÀN THÀNH 100% CÁC KIỂM THỬ XÁC THỰC JWT.");
}

run();
