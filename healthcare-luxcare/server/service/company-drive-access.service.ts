import { CompanyModel } from "../model/company.model";
import { googleDriveService } from "./google-drive.service";
import { googleOAuthService } from "./google-oauth.service";

export interface CompanyDriveAccess {
  accessToken: string;
  folderId: string;
  folderLink: string;
  email: string;
}

async function loadConnectedCompany(companyCode: string): Promise<any> {
  const normalized = String(companyCode || "").trim().toUpperCase();
  const company = await CompanyModel.findOne({ code: normalized });
  if (!company?.driveOAuth?.refreshToken) {
    throw new Error("Doanh nghiệp chưa kết nối Google Drive. Vui lòng liên hệ quản trị viên.");
  }
  return company;
}

async function accessFor(company: any): Promise<CompanyDriveAccess> {
  const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
  return {
    accessToken,
    folderId: company.driveFolderId || "",
    folderLink: company.driveFolderLink || "",
    email: company.driveOAuth.connectedEmail || "",
  };
}

export const companyDriveAccessService = {
  async get(companyCode: string): Promise<CompanyDriveAccess> {
    const company = await loadConnectedCompany(companyCode);
    if (!company.driveFolderId) {
      throw new Error("Thư mục Google Drive của doanh nghiệp chưa được khởi tạo.");
    }
    return accessFor(company);
  },

  async ensure(companyCode: string): Promise<CompanyDriveAccess> {
    const company = await loadConnectedCompany(companyCode);
    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
    if (!company.driveFolderId) {
      const folder = await googleDriveService.createFolder(
        accessToken,
        `iGen ERP - Tài liệu ${company.name || company.code}`,
      );
      company.driveFolderId = folder.id;
      company.driveFolderLink = folder.webViewLink || "";
      await company.save();
    }
    return {
      accessToken,
      folderId: company.driveFolderId,
      folderLink: company.driveFolderLink || "",
      email: company.driveOAuth.connectedEmail || "",
    };
  },
};
