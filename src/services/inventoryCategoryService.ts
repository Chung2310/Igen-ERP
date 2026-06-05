import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../config/firebase";
import { ProductCategory } from "../types";

const COLLECTION_NAME = "inventoryProductCategories";

type CategoryInput = {
  name: string;
  code: string;
  description: string;
};

const collectionRef = collection(db, COLLECTION_NAME);

export const inventoryCategoryService = {
  subscribe(callback: (categories: ProductCategory[]) => void, onError?: (error: unknown) => void) {
    const categoryQuery = query(collectionRef, orderBy("name", "asc"));

    return onSnapshot(
      categoryQuery,
      (snapshot) => {
        const categories = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ProductCategory, "id">),
        }));
        callback(categories);
      },
      (error) => {
        if (onError) {
          onError(error);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      }
    );
  },

  async createCategory(input: CategoryInput) {
    try {
      await addDoc(collectionRef, {
        name: input.name,
        code: input.code,
        description: input.description,
        colorClass: "bg-blue-50 text-blue-700 border-blue-100",
        status: "Đang dùng",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async updateCategory(id: string, input: CategoryInput) {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        name: input.name,
        code: input.code,
        description: input.description,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  async deleteCategory(id: string) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },
};
