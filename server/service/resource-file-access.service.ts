import type { ResourceStorageAccess, ResourceStorageProvider } from "../model/resource-item.model";
import { cloudinaryService } from "./cloudinary.service";

export interface FileAccessibleResource {
  _id: unknown;
  fileUrl?: string;
  storageProvider?: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
}

interface ResourceUrlSigner {
  signRaw(publicId: string, expiresAt: Date): string;
  signImage(publicId: string, expiresAt: Date): string;
}

interface ResourceFileAccessDependencies {
  signer: ResourceUrlSigner;
  now?: () => Date;
}

export function createResourceFileAccessService(dependencies: ResourceFileAccessDependencies) {
  return {
    withReadableFileUrl<T extends FileAccessibleResource>(item: T): T {
      if (
        item.storageAccess !== "authenticated"
        || item.storageProvider !== "cloudinary"
        || !item.storagePublicId
      ) {
        return item;
      }
      const now = dependencies.now?.() || new Date();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      const fileUrl = item.storageResourceType === "raw"
        ? dependencies.signer.signRaw(item.storagePublicId, expiresAt)
        : dependencies.signer.signImage(item.storagePublicId, expiresAt);
      return { ...item, fileUrl };
    },
  };
}

export const resourceFileAccessService = createResourceFileAccessService({
  signer: {
    signRaw: (publicId, expiresAt) => cloudinaryService.createSignedRawUrl(publicId, expiresAt),
    signImage: (publicId, expiresAt) => cloudinaryService.createSignedImageUrl(publicId, expiresAt),
  },
});
