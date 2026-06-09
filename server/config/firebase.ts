import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import fs from "fs";
import path from "path";

// Đọc tệp cấu hình firebase-applet-config.json từ thư mục gốc
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  throw new Error(`[Backend Firebase Config] Không tìm thấy tệp cấu hình tại: ${configPath}`);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Xác thực các trường cấu hình bắt buộc
const requiredFields = ["apiKey", "authDomain", "projectId", "appId"];
const missingFields = requiredFields.filter((field) => !firebaseConfig[field]);

if (missingFields.length > 0) {
  throw new Error(
    `[Backend Firebase Config Error] Thiếu các trường cấu hình bắt buộc trong file config: ${missingFields.join(
      ", "
    )}`
  );
}

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

// Khởi tạo Firestore database
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

console.log(`[Backend Firebase] Khởi tạo thành công cho dự án: ${firebaseConfig.projectId}`);

