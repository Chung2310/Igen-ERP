import { Response } from "express";
import { google } from "googleapis";
import { AuthenticatedRequest } from "../middleware/auth";
import { GoogleDriveService } from "../service/personal-google-drive.service";
import { UserModel } from "../model/user.model";
import { ResourceModel } from "../model/resource.model";

export const googleDriveController = {
  /**
   * GET /api/v1/integrations/google-drive/auth-url
   * Lấy URL màn hình xin quyền Google OAuth2
   */
  async initOAuth(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const authUrl = GoogleDriveService.getAuthUrl(userId);
      return res.status(200).json({ status: "success", authUrl });
    } catch (error: any) {
      console.error("[googleDriveController.initOAuth] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi tạo URL liên kết Google Drive.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/integrations/google-drive/callback
   * Tiếp nhận callback chuyển hướng từ Google
   */
  async oauthCallback(req: AuthenticatedRequest, res: Response) {
    const sendHtmlResponse = (status: "success" | "error", message: string, data?: any) => {
      const payload = { type: status === "success" ? "GOOGLE_DRIVE_CONNECTED" : "GOOGLE_DRIVE_FAILED", ...data, error: status === "error" ? message : undefined };
      return res.status(status === "success" ? 200 : 500).send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <title>${status === "success" ? "Kết nối thành công" : "Lỗi kết nối"}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: ${status === "success" ? "#f0fdf4" : "#fef2f2"}; margin: 0; }
            .box { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 400px; }
            h2 { color: ${status === "success" ? "#16a34a" : "#dc2626"}; margin-top: 0; }
            p { color: #4b5563; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>${status === "success" ? "✅ Kết nối thành công" : "❌ Kết nối thất bại"}</h2>
            <p>${message}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage(${JSON.stringify(payload)}, '*');
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
        </html>
      `);
    };

    try {
      const { code, error, error_description, state } = req.query;

      if (error) {
        return sendHtmlResponse("error", String(error_description || error));
      }

      if (!code) {
        return sendHtmlResponse("error", "Không tìm thấy mã code từ Google.");
      }

      const userId = String(state);
      if (!userId || userId.length !== 24) {
        return sendHtmlResponse("error", "Mã trạng thái userId không hợp lệ.");
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return sendHtmlResponse("error", "Không tìm thấy tài khoản người dùng tương ứng.");
      }

      // Đổi code lấy tokens
      const tokens = await GoogleDriveService.getTokensFromCode(String(code));
      if (!tokens.access_token || !tokens.refresh_token) {
        return sendHtmlResponse("error", "Không thể lấy đủ access token hoặc refresh token từ Google. Bạn cần xóa ứng dụng trong cài đặt tài khoản Google của bạn và cấp quyền lại để sinh refresh token.");
      }

      // Lấy email google đã kết nối
      const driveEmail = await GoogleDriveService.getDriveEmail(tokens.access_token);

      // Tạo client tạm thời để tạo thư mục root cho User nếu chưa có
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials(tokens);

      const folderId = await GoogleDriveService.createFolder(oauth2Client, "iGen ERP Resources");

      // Cập nhật thông tin vào DB
      user.googleDriveIntegration = {
        isConnected: true,
        driveEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiredAt: new Date(tokens.expiry_date!),
        rootFolderId: folderId,
        connectedAt: new Date(),
      };

      await user.save();

      return sendHtmlResponse("success", `Tài khoản ${driveEmail} đã được liên kết thành công với iGen ERP. Cửa sổ này sẽ tự đóng sau giây lát.`, { driveEmail });
    } catch (err: any) {
      console.error("[googleDriveController.oauthCallback] Error:", err);
      return sendHtmlResponse("error", err.message || "Lỗi xử lý luồng Callback OAuth Google.");
    }
  },

  /**
   * POST /api/v1/integrations/google-drive/disconnect
   * Hủy liên kết Google Drive của User
   */
  async disconnect(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy người dùng." });
      }

      user.googleDriveIntegration = null;
      await user.save();

      return res.status(200).json({
        status: "success",
        message: "Hủy liên kết tài khoản Google Drive cá nhân thành công.",
      });
    } catch (error: any) {
      console.error("[googleDriveController.disconnect] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hủy liên kết Google Drive.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/integrations/google-drive/resources
   * Lấy danh sách tài nguyên đã tải lên của User
   */
  async getResources(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Thông tin xác thực không hợp lệ." });
      }

      // Chỉ lấy tài nguyên do chính user này upload lên (hoặc cùng công ty tùy nhu cầu - ở đây lọc theo cá nhân)
      const resources = await ResourceModel.find({
        companyCode,
        uploadedBy: userId,
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        status: "success",
        data: resources,
      });
    } catch (error: any) {
      console.error("[googleDriveController.getResources] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách tài nguyên.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/integrations/google-drive/upload
   * Nhận file base64 và tải lên Google Drive của User
   */
  async uploadResource(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { file, name, mimeType } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (!file || !name || !mimeType) {
        return res.status(400).json({
          status: "error",
          message: "Thiếu dữ liệu tệp tin upload (file, name, hoặc mimeType).",
        });
      }

      const user = await UserModel.findById(userId);
      if (!user || !user.googleDriveIntegration || !user.googleDriveIntegration.rootFolderId) {
        return res.status(400).json({
          status: "error",
          message: "Tài khoản của bạn chưa liên kết Google Drive hoặc cấu hình thư mục lỗi.",
        });
      }

      // Decode base64 sang Buffer
      let base64Data = file;
      if (file.includes(";base64,")) {
        base64Data = file.split(";base64,").pop()!;
      }
      const fileBuffer = Buffer.from(base64Data, "base64");

      // Lấy oauth client được ủy quyền
      const authClient = await GoogleDriveService.getClientForUser(userId);

      // Upload lên Google Drive
      const driveFile = await GoogleDriveService.uploadFile(
        authClient,
        fileBuffer,
        name,
        mimeType,
        user.googleDriveIntegration.rootFolderId
      );

      // Lưu metadata vào MongoDB
      const resource = await ResourceModel.create({
        companyCode,
        uploadedBy: userId,
        name: driveFile.name || name,
        mimeType: driveFile.mimeType || mimeType,
        driveFileId: driveFile.id!,
        webViewLink: driveFile.webViewLink!,
        webContentLink: driveFile.webContentLink || undefined,
        thumbnailLink: driveFile.thumbnailLink || undefined,
        size: driveFile.size ? parseInt(String(driveFile.size), 10) : fileBuffer.length,
      });

      return res.status(200).json({
        status: "success",
        message: "Tải tài nguyên lên Google Drive thành công.",
        data: resource,
      });
    } catch (error: any) {
      console.error("[googleDriveController.uploadResource] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Tải tài nguyên lên thất bại.",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/integrations/google-drive/resources/:id
   * Xóa tài nguyên trên Google Drive và local DB
   */
  async deleteResource(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const resourceId = req.params.id;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const resource = await ResourceModel.findOne({
        _id: resourceId,
        uploadedBy: userId,
        companyCode,
      });

      if (!resource) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.",
        });
      }

      // Xóa trên Google Drive
      try {
        const authClient = await GoogleDriveService.getClientForUser(userId);
        await GoogleDriveService.deleteFile(authClient, resource.driveFileId);
      } catch (err: any) {
        // Log và cho phép xóa tiếp ở DB nếu file đã bị xóa trên Drive thủ công từ trước
        console.warn(`[googleDriveController.deleteResource] File không tìm thấy trên Drive hoặc không thể xóa:`, err.message);
      }

      // Xóa trong local DB
      await resource.deleteOne();

      return res.status(200).json({
        status: "success",
        message: "Xóa tài nguyên khỏi Google Drive và hệ thống thành công.",
      });
    } catch (error: any) {
      console.error("[googleDriveController.deleteResource] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Xóa tài nguyên thất bại.",
        details: error.message,
      });
    }
  },
};
