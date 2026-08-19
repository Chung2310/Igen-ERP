import fetch from "node:fetch";

async function testEndpoint(url, token) {
  try {
    const res = await fetch("http://localhost:3000/api/v1" + url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 || (body && body.status === "error")) {
      console.log(`❌ 403 or Error on ${url}:`, body);
    } else {
      console.log(`✅ Success on ${url}: status ${res.status}`);
    }
  } catch (error) {
    console.log(`💥 Request failed for ${url}:`, error.message);
  }
}

async function run() {
  console.log("Logging in...");
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "abc@gmail.com", password: "123456" })
  });
  
  if (!loginRes.ok) {
    console.error("Login failed:", await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log("Logged in successfully. Token acquired.");

  const endpoints = [
    "/auth/me",
    "/student-management/settings",
    "/student-management/custom-fields/students",
    "/student-management/custom-fields/workers",
    "/student-management/standard-fields/students",
    "/student-management/standard-fields/workers",
    "/student-notifications",
    "/student-resources",
    "/courses",
    "/batches",
    "/schedule",
    "/partners",
    "/dashboard/summary",
    "/dashboard/action-items",
    "/chat/rooms",
    "/timekeeping",
    "/kanban"
  ];

  for (const ep of endpoints) {
    await testEndpoint(ep, token);
  }
}

run().catch(console.error);
