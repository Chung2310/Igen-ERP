import "dotenv/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

const COLLECTION_NAME = "inventoryProductCategories";

async function run() {
  const email = process.env.VITE_SUPERADMIN_EMAIL;
  const password = process.env.VITE_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing VITE_SUPERADMIN_EMAIL or VITE_SUPERADMIN_PASSWORD in environment.");
  }

  await signInWithEmailAndPassword(auth, email, password);

  const uniqueCode = `TEST_${Date.now()}`;
  const created = await addDoc(collection(db, COLLECTION_NAME), {
    name: `Danh mục test ${Date.now()}`,
    code: uniqueCode,
    description: "Danh mục tạm để kiểm thử CRUD Firebase",
    colorClass: "bg-blue-50 text-blue-700 border-blue-100",
    status: "Đang dùng",
  });

  await updateDoc(doc(db, COLLECTION_NAME, created.id), {
    description: "Danh mục tạm đã được cập nhật trong bài test",
  });

  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where("code", "==", uniqueCode)));
  const matched = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  await deleteDoc(doc(db, COLLECTION_NAME, created.id));

  console.log(JSON.stringify({ ok: true, collection: COLLECTION_NAME, createdId: created.id, matchedCount: matched.length, matched }, null, 2));
}

run().catch((error) => {
  console.error("[inventory-category-firestore-test]", error instanceof Error ? error.message : error);
  process.exit(1);
});
