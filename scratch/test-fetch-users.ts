import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "http://localhost:3000/api/v1";

async function run() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "vngchua@igen.com",
      password: "123456"
    })
  });

  console.log("Login Status:", loginRes.status);
  const loginData: any = await loginRes.json();
  if (loginRes.status !== 200) {
    console.error("Login failed:", loginData);
    return;
  }

  const token = loginData.accessToken;
  const headers = {
    "Authorization": `Bearer ${token}`
  };

  // 1. Fetch Users
  console.log("\n--- Fetching Users ---");
  const usersRes = await fetch(`${BASE_URL}/auth/users?companyCode=VNG123`, { headers });
  console.log("Users Fetch Status:", usersRes.status);
  const usersData = await usersRes.json();
  console.log("Users Fetch Data keys:", Object.keys(usersData));

  // 2. Fetch Role Permissions
  console.log("\n--- Fetching Role Permissions ---");
  const rpRes = await fetch(`${BASE_URL}/role-permissions?companyCode=VNG123`, { headers });
  console.log("Role Permissions Fetch Status:", rpRes.status);
  const rpData = await rpRes.json();
  console.log("Role Permissions Fetch Data:", JSON.stringify(rpData, null, 2));

  // 3. Fetch Permissions
  console.log("\n--- Fetching System Permissions ---");
  const permRes = await fetch(`${BASE_URL}/permissions`, { headers });
  console.log("Permissions Fetch Status:", permRes.status);
  const permData = await permRes.json();
  console.log("Permissions Fetch Data keys:", Object.keys(permData));
}

run().catch(console.error);
