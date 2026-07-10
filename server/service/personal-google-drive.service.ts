import { google } from "googleapis";
import { Readable } from "stream";
import { UserModel } from "../model/user.model";

export class GoogleDriveService {
  private static getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        "Cấu hình Google Drive chưa đầy đủ. Vui lòng kiểm tra GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI trong file .env"
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Sinh URL màn hình xin quyền OAuth Google
   */
  public static getAuthUrl(userId: string): string {
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account consent",
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state: userId,
    });
  }

  /**
   * Đổi mã code lấy Tokens
   */
  public static async getTokensFromCode(code: string) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Lấy địa chỉ Email của tài khoản Google đã liên kết
   */
  public static async getDriveEmail(accessToken: string): Promise<string> {
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data.email || "";
  }

  /**
   * Tạo thư mục mới trên Google Drive
   */
  public static async createFolder(auth: any, name: string): Promise<string> {
    const drive = google.drive({ version: "v3", auth });
    
    // Tìm xem thư mục đã tồn tại chưa để tránh tạo trùng
    const response = await drive.files.list({
      q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    const fileMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    return folder.data.id!;
  }

  /**
   * Khởi tạo OAuth2 Client có sẵn thông tin xác thực cho user và tự động làm mới token nếu cần
   */
  public static async getClientForUser(userId: string): Promise<any> {
    const user = await UserModel.findById(userId);
    if (!user || !user.googleDriveIntegration || !user.googleDriveIntegration.isConnected) {
      throw new Error("Người dùng chưa kết nối Google Drive.");
    }

    const integration = user.googleDriveIntegration;
    const oauth2Client = this.getOAuth2Client();

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: new Date(integration.tokenExpiredAt).getTime(),
    });

    // Nếu token đã hết hạn hoặc sắp hết hạn (trong vòng 5 phút)
    const isExpired = Date.now() >= (new Date(integration.tokenExpiredAt).getTime() - 5 * 60 * 1000);
    if (isExpired && integration.refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          integration.accessToken = credentials.access_token;
          if (credentials.expiry_date) {
            integration.tokenExpiredAt = new Date(credentials.expiry_date);
          }
          user.googleDriveIntegration = integration;
          await user.save();
          
          oauth2Client.setCredentials(credentials);
        }
      } catch (err: any) {
        console.error("Lỗi tự động refresh token Google Drive:", err);
        throw new Error("Phiên kết nối Google Drive đã hết hạn. Vui lòng kết nối lại tài khoản.");
      }
    }

    return oauth2Client;
  }

  /**
   * Tải tệp lên Google Drive
   */
  public static async uploadFile(
    auth: any,
    buffer: Buffer,
    name: string,
    mimeType: string,
    parentId: string
  ) {
    const drive = google.drive({ version: "v3", auth });
    
    // Đọc buffer dưới dạng stream Readable
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const fileMetadata = {
      name,
      parents: [parentId],
    };

    const media = {
      mimeType,
      body: stream,
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size",
    });

    // Cấp quyền đọc cho tất cả mọi người để có thể lấy link thumbnail và download trực tiếp hiển thị trên ERP
    try {
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (err: any) {
      console.warn("Không thể thiết lập quyền công khai cho file:", err.message);
    }

    return file.data;
  }

  /**
   * Xóa file khỏi Google Drive
   */
  public static async deleteFile(auth: any, fileId: string): Promise<void> {
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId });
  }
}