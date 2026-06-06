import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import firebaseConfigRaw from '../../firebase-applet-config.json';


interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

const firebaseConfig = firebaseConfigRaw as FirebaseAppletConfig;

// 1. Xác thực cấu hình bắt buộc trước khi khởi tạo
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const missingFields = requiredFields.filter((field) => !firebaseConfig[field]);

if (missingFields.length > 0) {
  throw new Error(`[Firebase Config Error] Thiếu các trường cấu hình bắt buộc: ${missingFields.join(', ')}`);
}

// 2. Khởi tạo Firebase App an toàn (Tránh re-initialization khi HMR hoạt động)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as any);

// 3. Khởi tạo Firestore với Database ID hợp lệ và local cache persistence
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, databaseId);
} catch (e) {
  firestoreDb = getFirestore(app, databaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);
// Firebase Cloud Functions - region asia-southeast1 (Singapore, gần VN)
export const functions = getFunctions(app, 'asia-southeast1');

// Connect to local functions emulator in development mode
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  console.log('[Firebase Config] Connected to local functions emulator on port 5001');
}


// Error Handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Production Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
