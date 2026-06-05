import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, handleFirestoreError, OperationType, storage } from "../config/firebase";
import { ProductItem } from "../types";

const COLLECTION_NAME = "inventoryProducts";
const STORAGE_FOLDER = "inventory/products";

type ProductInput = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  imageFile?: File | null;
  imageUrl?: string;
};

type ProductMutationResult = {
  imageUploadFailed: boolean;
  productId?: string;
};

const collectionRef = collection(db, COLLECTION_NAME);

async function uploadProductImage(file: File, sku: string) {
  try {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeSku = sku.replace(/[^a-zA-Z0-9-_]/g, "_");
    const storageRef = ref(storage, `${STORAGE_FOLDER}/${safeSku}_${Date.now()}.${extension}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch {
    return null;
  }
}

export const inventoryProductService = {
  subscribe(callback: (products: ProductItem[]) => void, onError?: (error: unknown) => void) {
    const productQuery = query(collectionRef, orderBy("name", "asc"));

    return onSnapshot(
      productQuery,
      (snapshot) => {
        const products = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ProductItem, "id">),
        }));
        callback(products);
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

  async ensureSkuAvailable(sku: string, ignoreId?: string) {
    try {
      const skuQuery = query(collectionRef, where("sku", "==", sku));
      const snapshot = await getDocs(skuQuery);
      return !snapshot.docs.some((item) => item.id !== ignoreId);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  async createProduct(input: ProductInput): Promise<ProductMutationResult> {
    try {
      const uploadedImageUrl = input.imageFile ? await uploadProductImage(input.imageFile, input.sku) : null;
      const imageUploadFailed = Boolean(input.imageFile) && !uploadedImageUrl;

      const createdDoc = await addDoc(collectionRef, {
        sku: input.sku,
        name: input.name,
        category: input.category,
        stock: input.stock,
        minStockAlert: 15,
        price: input.price,
        demandForecast: "Ổn định",
        imageUrl: uploadedImageUrl || input.imageUrl || "",
      });

      return { imageUploadFailed, productId: createdDoc.id };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async updateProduct(id: string, input: ProductInput): Promise<ProductMutationResult> {
    try {
      const uploadedImageUrl = input.imageFile ? await uploadProductImage(input.imageFile, input.sku) : input.imageUrl;
      const imageUploadFailed = Boolean(input.imageFile) && !uploadedImageUrl;

      await updateDoc(doc(db, COLLECTION_NAME, id), {
        sku: input.sku,
        name: input.name,
        category: input.category,
        stock: input.stock,
        price: input.price,
        imageUrl: uploadedImageUrl || input.imageUrl || "",
      });

      return { imageUploadFailed };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  async updateProductsCategoryName(previousCategoryName: string, nextCategoryName: string) {
    try {
      const productQuery = query(collectionRef, where("category", "==", previousCategoryName));
      const snapshot = await getDocs(productQuery);

      await Promise.all(snapshot.docs.map((item) => updateDoc(item.ref, { category: nextCategoryName })));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    }
  },

  async moveProductsToUncategorized(categoryName: string) {
    try {
      const productQuery = query(collectionRef, where("category", "==", categoryName));
      const snapshot = await getDocs(productQuery);

      await Promise.all(snapshot.docs.map((item) => updateDoc(item.ref, { category: "Chưa phân loại" })));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    }
  },

  async updateProductStock(id: string, stock: number) {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), { stock });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}/stock`);
    }
  },

  async deleteProduct(id: string) {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },
};
