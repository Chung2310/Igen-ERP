import type { Contract, Extension, ContractFileItem } from "../types/hrContract";
export const getContractFiles = (contract: Contract): ContractFileItem[] => {
  if (Array.isArray(contract.contractFiles) && contract.contractFiles.length > 0) {
    return contract.contractFiles;
  }
  if (contract.contractFileUrl) {
    return [
      {
        url: contract.contractFileUrl,
        name: contract.contractFileName || "Tệp hợp đồng",
        mimeType: contract.contractFileMimeType,
        size: contract.contractFileSize,
        resourceId: contract.contractResourceId,
      },
    ];
  }
  return [];
};
export const getSignedImages = (contract: Contract): ContractFileItem[] => {
  if (Array.isArray(contract.signedImages) && contract.signedImages.length > 0) {
    return contract.signedImages;
  }
  if (contract.signedImageUrl) {
    return [
      {
        url: contract.signedImageUrl,
        name: contract.signedImageName || "Ảnh đã ký",
        mimeType: contract.signedImageMimeType,
        size: contract.signedImageSize,
        resourceId: contract.signedImageResourceId,
      },
    ];
  }
  return [];
};
export const getExtensionFiles = (ext: Extension): ContractFileItem[] => {
  if (Array.isArray(ext.extensionFiles) && ext.extensionFiles.length > 0) {
    return ext.extensionFiles;
  }
  if (ext.extensionFileUrl) {
    return [
      {
        url: ext.extensionFileUrl,
        name: ext.extensionFileName || "Tệp gia hạn",
        mimeType: ext.extensionFileMimeType,
        size: ext.extensionFileSize,
        resourceId: ext.extensionResourceId,
      },
    ];
  }
  return [];
};
export const getExtensionSignedImages = (ext: Extension): ContractFileItem[] => {
  if (Array.isArray(ext.signedImages) && ext.signedImages.length > 0) {
    return ext.signedImages;
  }
  if (ext.signedImageUrl) {
    return [
      {
        url: ext.signedImageUrl,
        name: ext.signedImageName || "Ảnh phụ lục đã ký",
        mimeType: ext.signedImageMimeType,
        size: ext.signedImageSize,
        resourceId: ext.signedImageResourceId,
      },
    ];
  }
  return [];
};
