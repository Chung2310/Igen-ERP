import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../config/firebase";
import { LeadCard } from "../types";

export interface LeadProductSelection {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ExtendedLeadCard extends LeadCard {
  lastInteractionTime?: string;
  createdAt?: any;
  updatedAt?: any;
  selectedProducts?: LeadProductSelection[];
}

const COLLECTION_NAME = "crmLeads";
const collectionRef = collection(db, COLLECTION_NAME);

function logCrmTiming(
  operation: "subscribe" | "create" | "update" | "delete" | "bulkUpdate",
  startedAt: number,
  details?: Record<string, unknown>
) {
  const durationMs = Date.now() - startedAt;
  console.info(`[CRM:${operation}]`, {
    collection: COLLECTION_NAME,
    durationMs,
    ...details,
  });
}

export const crmService = {
  subscribeLeads(callback: (leads: ExtendedLeadCard[]) => void, onError?: (error: unknown) => void) {
    const leadsQuery = query(collectionRef, orderBy("createdAt", "desc"));

    return onSnapshot(
      leadsQuery,
      (snapshot) => {
        const startedAt = Date.now();
        const leads = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ExtendedLeadCard, "id">),
        }));

        logCrmTiming("subscribe", startedAt, {
          count: leads.length,
          empty: snapshot.empty,
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
        callback(leads);
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

  async createLead(lead: Omit<ExtendedLeadCard, "id">): Promise<string> {
    const startedAt = Date.now();
    try {
      const docRef = await addDoc(collectionRef, {
        ...lead,
        createdAt: Date.now(),
      });
      logCrmTiming("create", startedAt, { id: docRef.id });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
      throw error;
    }
  },

  async updateLead(id: string, lead: Partial<ExtendedLeadCard>): Promise<void> {
    const startedAt = Date.now();
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        ...lead,
        updatedAt: Date.now(),
      });
      logCrmTiming("update", startedAt, { id, fields: Object.keys(lead) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },

  async deleteLead(id: string): Promise<void> {
    const startedAt = Date.now();
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      logCrmTiming("delete", startedAt, { id });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },

  async bulkUpdateLeads(updates: Array<{ id: string; lead: Partial<ExtendedLeadCard> }>): Promise<void> {
    const startedAt = Date.now();
    try {
      if (updates.length === 0) return;

      const batch = writeBatch(db);
      updates.forEach(({ id, lead }) => {
        batch.update(doc(db, COLLECTION_NAME, id), {
          ...lead,
          updatedAt: Date.now(),
        });
      });
      await batch.commit();
      logCrmTiming("bulkUpdate", startedAt, {
        count: updates.length,
        ids: updates.map(({ id }) => id),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/bulk-update`);
      throw error;
    }
  },
};
