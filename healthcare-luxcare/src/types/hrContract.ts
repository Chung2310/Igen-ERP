export type ContractStatus = "draft" | "active" | "expired" | "terminated";

export type ContractFileItem = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
  resourceId?: string;
  uploadToken?: string;
};

export type Contract = {
  _id: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  contractFileUrl?: string;
  contractFileName?: string;
  contractFileMimeType?: string;
  contractFileSize?: number;
  contractResourceId?: string;
  contractFiles?: ContractFileItem[];
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  signedImages?: ContractFileItem[];
  note?: string;
};

export type Employee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
};

export type Extension = {
  _id: string;
  contractId: string;
  employeeName: string;
  previousEndDate: string;
  newEndDate: string;
  extensionDate: string;
  reason?: string;
  extensionFileUrl?: string;
  extensionFileName?: string;
  extensionFileMimeType?: string;
  extensionFileSize?: number;
  extensionResourceId?: string;
  extensionFiles?: ContractFileItem[];
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  signedImages?: ContractFileItem[];
};
