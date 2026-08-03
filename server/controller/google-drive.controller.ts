import { Response } from "express";
import { google } from "googleapis";
import { AuthenticatedRequest } from "../middleware/auth";
import { GoogleDriveService } from "../service/personal-google-drive.service";
import { UserModel } from "../model/user.model";
import { ResourceModel } from "../model/resource.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { canAccessPersonalDriveTarget } from "../utils/personal-drive-access";

/**
 * Helper lấy OAuth2 Client và rootFolderId dựa trên Google Drive của doanh nghiệp (hoặc cá nhân làm fallback).
 */
async function getDriveClientAndRoot(companyCode: string, userId: string) {
  const { CompanyModel } = await import("../model/company.model");
  const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() });

  if (company && company.driveOAuth?.refreshToken) {
    const { googleOAuthService } = await import("../service/google-oauth.service");
    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: company.driveOAuth.refreshToken
    });

    if (!company.driveFolderId) {
      const { googleDriveService } = await import("../service/google-drive.service");
      const folder = await googleDriveService.createFolder(
        accessToken,
        `iGen ERP - Tài liệu ${company.name || company.code}`
      );
      company.driveFolderId = folder.id;
      company.driveFolderLink = folder.webViewLink || "";
      await company.save();
    }

    return {
      authClient: oauth2Client,
      rootFolderId: company.driveFolderId,
      isConnected: true,
      email: company.driveOAuth.connectedEmail || "Company Google Drive",
      isCompanyDrive: true
    };
  }

  // Fallback sang Google Drive cá nhân
  const user = await UserModel.findById(userId);
  if (user && user.googleDriveIntegration?.isConnected) {
    const authClient = await GoogleDriveService.getClientForUser(userId);
    return {
      authClient,
      rootFolderId: user.googleDriveIntegration.rootFolderId,
      isConnected: true,
      email: user.googleDriveIntegration.driveEmail || "",
      isCompanyDrive: false
    };
  }

  return {
    authClient: null,
    rootFolderId: "",
    isConnected: false,
    email: "",
    isCompanyDrive: false
  };
}

/**
 * Helper lấy OAuth2 Client và rootFolderId của tài khoản Google Drive quản trị doanh nghiệp
 */
async function getAdminDriveClient(companyCode: string, loggedInUserId?: string) {
  const { CompanyModel } = await import("../model/company.model");
  const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() });

  if (company && company.driveOAuth?.refreshToken) {
    const { googleOAuthService } = await import("../service/google-oauth.service");
    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: company.driveOAuth.refreshToken
    });

    if (!company.driveFolderId) {
      const { googleDriveService } = await import("../service/google-drive.service");
      const folder = await googleDriveService.createFolder(
        accessToken,
        `iGen ERP - Tài liệu ${company.name || company.code}`
      );
      company.driveFolderId = folder.id;
      company.driveFolderLink = folder.webViewLink || "";
      await company.save();
    }

    return {
      authClient: oauth2Client,
      rootFolderId: company.driveFolderId,
      adminUser: { displayName: "Doanh nghiệp", email: company.ownerEmail || "" }
    };
  }

  let adminUser = null;

  // 1. Nếu có loggedInUserId, kiểm tra xem người này có phải là admin/superadmin và đã kết nối Drive không
  if (loggedInUserId) {
    adminUser = await UserModel.findOne({
      _id: loggedInUserId,
      companyCode,
      role: { $in: ["admin", "superadmin"] },
      "googleDriveIntegration.isConnected": true,
    });
  }

  // 2. Fallback: Tìm tài khoản admin hoặc superadmin đầu tiên của công ty đã kết nối Drive
  if (!adminUser) {
    adminUser = await UserModel.findOne({
      companyCode,
      role: { $in: ["admin", "superadmin"] },
      "googleDriveIntegration.isConnected": true,
    });
  }

  // 3. Fallback 2: Thử tìm bất kỳ superadmin nào trong hệ thống đã kết nối Drive (fallback)
  if (!adminUser) {
    adminUser = await UserModel.findOne({
      role: "superadmin",
      "googleDriveIntegration.isConnected": true,
    });
  }

  if (!adminUser || !adminUser.googleDriveIntegration || !adminUser.googleDriveIntegration.isConnected) {
    throw new Error("Doanh nghiệp chưa cấu hình/liên kết tài khoản Google Drive quản trị (Admin/Super Admin). Vui lòng cấu hình ở cài đặt cá nhân của Admin.");
  }

  const authClient = await GoogleDriveService.getClientForUser(adminUser._id.toString());
  return {
    authClient,
    rootFolderId: adminUser.googleDriveIntegration.rootFolderId,
    adminUser,
  };
}

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
   * Lấy danh sách tài nguyên từ Google Drive của User (hỗ trợ điều hướng thư mục)
   */
  async getResources(req: AuthenticatedRequest, res: Response) {
    try {
      let userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const folderId = req.query.folderId as string;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Thông tin xác thực không hợp lệ." });
      }

      if ((userRole === "admin" || userRole === "superadmin") && req.query.ownerId) {
        userId = req.query.ownerId as string;
      }

      const driveInfo = await getDriveClientAndRoot(companyCode, userId);
      if (!driveInfo.isConnected) {
        return res.status(400).json({ status: "error", message: "Tài khoản chưa kết nối Google Drive." });
      }

      const user = await UserModel.findById(userId);
      // Chặn truy cập chéo công ty: chỉ superadmin mới được thay mặt user ngoài công ty của mình
      if (user && !canAccessPersonalDriveTarget({
        callerId: req.user?.id,
        callerRole: userRole,
        callerCompanyCode: companyCode,
        targetUserId: userId,
        targetCompanyCode: user.companyCode,
      })) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập tài nguyên của người dùng này." });
      }

      const drive = google.drive({ version: "v3", auth: driveInfo.authClient });

      let targetFolderId = folderId;
      if (!targetFolderId || targetFolderId === "root" || targetFolderId === "personal") {
        targetFolderId = driveInfo.rootFolderId;
      }

      const response = await drive.files.list({
        q: `'${targetFolderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size, createdTime)",
        orderBy: "folder,name",
      });

      const files = response.data.files || [];
      const mappedResources = files.map((file: any) => ({
        _id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        driveFileId: file.id,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        thumbnailLink: file.thumbnailLink,
        size: file.size ? parseInt(file.size, 10) : undefined,
        createdAt: file.createdTime,
      }));

      return res.status(200).json({
        status: "success",
        data: mappedResources,
      });
    } catch (error: any) {
      console.error("[googleDriveController.getResources] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách tài nguyên từ Google Drive.",
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
      let userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { file, name, mimeType, folderId, ownerId } = req.body;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if ((userRole === "admin" || userRole === "superadmin") && ownerId) {
        userId = ownerId;
      }

      if (!file || !name || !mimeType) {
        return res.status(400).json({
          status: "error",
          message: "Thiếu dữ liệu tệp tin upload (file, name, hoặc mimeType).",
        });
      }

      const driveInfo = await getDriveClientAndRoot(companyCode, userId);
      if (!driveInfo.isConnected) {
        return res.status(400).json({
          status: "error",
          message: "Tài khoản chưa kết nối Google Drive.",
        });
      }

      const user = await UserModel.findById(userId);
      // Chặn truy cập chéo công ty: chỉ superadmin mới được thay mặt user ngoài công ty của mình
      if (user && !canAccessPersonalDriveTarget({
        callerId: req.user?.id,
        callerRole: userRole,
        callerCompanyCode: companyCode,
        targetUserId: userId,
        targetCompanyCode: user.companyCode,
      })) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền tải lên tài nguyên của người dùng này." });
      }

      // Decode base64 sang Buffer
      let base64Data = file;
      if (file.includes(";base64,")) {
        base64Data = file.split(";base64,").pop()!;
      }
      const fileBuffer = Buffer.from(base64Data, "base64");

      // Lấy oauth client được ủy quyền
      const authClient = driveInfo.authClient;

      // Xác định thư mục cha để upload
      const parentFolderId = (folderId && folderId !== "root" && folderId !== "personal") ? folderId : driveInfo.rootFolderId;

      // Upload lên Google Drive
      const driveFile = await GoogleDriveService.uploadFile(
        authClient,
        fileBuffer,
        name,
        mimeType,
        parentFolderId
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
   * GET /api/v1/integrations/google-drive/resources/group/:roomId
   * Lấy danh sách tài nguyên từ Google Drive của phòng chat/nhóm (hỗ trợ điều hướng thư mục)
   */
  async getGroupResources(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const folderId = req.query.folderId as string;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Thông tin xác thực không hợp lệ." });
      }

      // 1. Tìm phòng chat và populate thông tin thành viên
      const chatRoom = await ChatRoomModel.findOne({ _id: roomId, companyCode })
        .populate("members.userId", "displayName photoURL email role status");
      if (!chatRoom) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phòng chat." });
      }

      // 2. Kiểm tra quyền truy cập phòng chat
      const getUserIdString = (u: any) => (u && typeof u === "object" ? (u._id || u.id || u).toString() : String(u));
      const isMember = chatRoom.members.some(m => getUserIdString(m.userId) === userId);
      const isCompanyWide = chatRoom.driveGeneralAccess === "company";
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (!isMember && !isCompanyWide && !isAdmin) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập tài liệu của nhóm này." });
      }

      // 3. Nếu phòng chat chưa có driveFolderId, tiến hành khởi tạo tự động
      const adminInfo = await getAdminDriveClient(companyCode, req.user?.id);
      const drive = google.drive({ version: "v3", auth: adminInfo.authClient });

      if (!chatRoom.driveFolderId) {
        try {
          // Tạo thư mục "iGen Shared Groups" trong root folder của Admin nếu chưa có
          const sharedGroupsFolderId = await GoogleDriveService.createFolder(adminInfo.authClient, "iGen Shared Groups");
          
          // Tạo thư mục cụ thể cho phòng chat này
          const fileMetadata = {
            name: chatRoom.name || `Nhóm_${roomId}`,
            mimeType: "application/vnd.google-apps.folder",
            parents: [sharedGroupsFolderId]
          };
          const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id"
          });
          
          // Cấp quyền đọc công khai cho thư mục này để lấy thumbnail/download link hiển thị
          try {
            await drive.permissions.create({
              fileId: folder.data.id!,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
            });
          } catch (err: any) {
             console.warn("Không thể thiết lập quyền công khai cho thư mục nhóm:", err.message);
          }

          chatRoom.driveFolderId = folder.data.id!;
          await chatRoom.save();
        } catch (driveErr: any) {
          console.error("[getGroupResources] Google Drive Init Folder Error:", driveErr);
          return res.status(500).json({
            status: "error",
            message: "Lỗi kết nối Google Drive của hệ thống quản trị: " + driveErr.message
          });
        }
      }

      // 4. Lấy danh sách tệp trực tiếp từ Google Drive API theo thư mục hiện tại
      let targetFolderId = folderId;
      if (!targetFolderId || targetFolderId === "root" || targetFolderId === roomId) {
        targetFolderId = chatRoom.driveFolderId;
      }

      let files: any[] = [];
      try {
        const response = await drive.files.list({
          q: `'${targetFolderId}' in parents and trashed = false`,
          fields: "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size, createdTime)",
          orderBy: "folder,name",
        });
        files = response.data.files || [];
      } catch (listErr: any) {
        const isPermissionOrNotFound = listErr.status === 403 || listErr.status === 404 || 
          (listErr.message && (listErr.message.includes("Insufficient permissions") || listErr.message.includes("not found")));
        
        if (isPermissionOrNotFound && targetFolderId === chatRoom.driveFolderId) {
          console.warn("[getGroupResources] Phát hiện lỗi quyền truy cập hoặc thư mục không tồn tại. Tiến hành khởi tạo lại thư mục mới...");
          try {
            const sharedGroupsFolderId = await GoogleDriveService.createFolder(adminInfo.authClient, "iGen Shared Groups");
            const newFolder = await drive.files.create({
              requestBody: {
                name: chatRoom.name || `Nhóm_${roomId}`,
                mimeType: "application/vnd.google-apps.folder",
                parents: [sharedGroupsFolderId]
              },
              fields: "id"
            });
            
            try {
              await drive.permissions.create({
                fileId: newFolder.data.id!,
                requestBody: { role: "reader", type: "anyone" }
              });
            } catch (permErr: any) {
              console.warn("Không thể thiết lập quyền công khai cho thư mục nhóm mới:", permErr.message);
            }

            chatRoom.driveFolderId = newFolder.data.id!;
            await chatRoom.save();
            targetFolderId = chatRoom.driveFolderId;
            
            const response = await drive.files.list({
              q: `'${targetFolderId}' in parents and trashed = false`,
              fields: "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size, createdTime)",
              orderBy: "folder,name",
            });
            files = response.data.files || [];
          } catch (recreateErr: any) {
            console.error("[getGroupResources] Không thể tự động tạo lại thư mục nhóm mới:", recreateErr);
            throw listErr;
          }
        } else {
          throw listErr;
        }
      }
      const driveFileIds = files.map((f: any) => f.id);
      const dbResources = await ResourceModel.find({
        companyCode,
        driveFileId: { $in: driveFileIds }
      }).select("driveFileId uploadedBy").lean();

      const resourceOwnerMap = new Map(dbResources.map(r => [r.driveFileId, String(r.uploadedBy)]));

      const mappedResources = files.map((file: any) => ({
        _id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        driveFileId: file.id,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        thumbnailLink: file.thumbnailLink,
        size: file.size ? parseInt(file.size, 10) : undefined,
        createdAt: file.createdTime,
        uploadedBy: resourceOwnerMap.get(file.id)
      }));

      return res.status(200).json({
        status: "success",
        data: mappedResources,
        driveFolderId: chatRoom.driveFolderId,
        driveGeneralAccess: chatRoom.driveGeneralAccess || "restricted",
        members: chatRoom.members
      });
    } catch (error: any) {
      console.error("[googleDriveController.getGroupResources] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi lấy danh sách tài nguyên nhóm từ Google Drive.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/integrations/google-drive/upload/group/:roomId
   * Tải tệp lên thư mục Google Drive của nhóm
   */
  async uploadGroupResource(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { file, name, mimeType, folderId } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (!file || !name || !mimeType) {
        return res.status(400).json({
          status: "error",
          message: "Thiếu dữ liệu tệp tin upload (file, name, hoặc mimeType).",
        });
      }

      // 1. Tìm phòng chat
      const chatRoom = await ChatRoomModel.findOne({ _id: roomId, companyCode });
      if (!chatRoom) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phòng chat." });
      }

      // 2. Kiểm tra quyền tải lên (phải là Uploader hoặc Admin/Super Admin hệ thống)
      const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
      const isUploader = memberInfo?.canUploadDrive === true;
      const isRoomAdmin = memberInfo?.role === "admin";
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (!isUploader && !isRoomAdmin && !isAdmin) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền tải lên tài liệu cho nhóm này. Vui lòng liên hệ Admin/Super Admin phòng."
        });
      }

      // Đảm bảo thư mục đã tồn tại
      if (!chatRoom.driveFolderId) {
        return res.status(400).json({
          status: "error",
          message: "Thư mục nhóm trên Google Drive chưa được khởi tạo. Vui lòng truy cập lại không gian này để tự động tạo."
        });
      }

      // 3. Lấy client Drive của Admin doanh nghiệp
      const { authClient } = await getAdminDriveClient(companyCode, req.user?.id);

      // Decode base64 sang Buffer
      let base64Data = file;
      if (file.includes(";base64,")) {
        base64Data = file.split(";base64,").pop()!;
      }
      const fileBuffer = Buffer.from(base64Data, "base64");

      // Xác định thư mục cha để upload
      const parentFolderId = (folderId && folderId !== "root" && folderId !== roomId) ? folderId : chatRoom.driveFolderId;

      // Upload lên Google Drive dưới thư mục của nhóm
      let driveFile;
      let actualParentId = parentFolderId;
      try {
        driveFile = await GoogleDriveService.uploadFile(
          authClient,
          fileBuffer,
          name,
          mimeType,
          actualParentId
        );
      } catch (uploadErr: any) {
        const isPermissionOrNotFound = uploadErr.status === 403 || uploadErr.status === 404 || 
          (uploadErr.message && (uploadErr.message.includes("Insufficient permissions") || uploadErr.message.includes("not found")));

        if (isPermissionOrNotFound && actualParentId === chatRoom.driveFolderId) {
          console.warn("[uploadGroupResource] Thư mục cha không hợp lệ hoặc thiếu quyền. Tiến hành khởi tạo lại thư mục mới...");
          try {
            const sharedGroupsFolderId = await GoogleDriveService.createFolder(authClient, "iGen Shared Groups");
            const drive = google.drive({ version: "v3", auth: authClient });
            const newFolder = await drive.files.create({
              requestBody: {
                name: chatRoom.name || `Nhóm_${roomId}`,
                mimeType: "application/vnd.google-apps.folder",
                parents: [sharedGroupsFolderId]
              },
              fields: "id"
            });
            
            try {
              await drive.permissions.create({
                fileId: newFolder.data.id!,
                requestBody: { role: "reader", type: "anyone" }
              });
            } catch (permErr: any) {
              console.warn("Không thể thiết lập quyền công khai cho thư mục nhóm mới:", permErr.message);
            }

            chatRoom.driveFolderId = newFolder.data.id!;
            await chatRoom.save();
            actualParentId = chatRoom.driveFolderId;

            // Thử upload lại tệp lên thư mục mới
            driveFile = await GoogleDriveService.uploadFile(
              authClient,
              fileBuffer,
              name,
              mimeType,
              actualParentId
            );
          } catch (recreateErr: any) {
            console.error("[uploadGroupResource] Khôi phục thư mục và upload lại thất bại:", recreateErr);
            throw uploadErr;
          }
        } else {
          throw uploadErr;
        }
      }

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
        chatRoomId: roomId
      });

      return res.status(200).json({
        status: "success",
        message: "Tải tài nguyên lên thư mục nhóm Google Drive thành công.",
        data: resource
      });
    } catch (error: any) {
      console.error("[googleDriveController.uploadGroupResource] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Tải tài nguyên lên nhóm thất bại.",
        details: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/integrations/google-drive/groups/:roomId/permissions
   * Cập nhật phân quyền truy cập Google Drive của nhóm
   */
  async updateGroupPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { roomId } = req.params;
      const { members, driveGeneralAccess } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      // 1. Tìm phòng chat
      const chatRoom = await ChatRoomModel.findOne({ _id: roomId, companyCode });
      if (!chatRoom) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phòng chat." });
      }

      // 2. Kiểm tra quyền sửa (phải là room creator, room admin, hoặc Admin/Super Admin hệ thống)
      const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
      const isRoomAdmin = memberInfo?.role === "admin";
      const isCreator = chatRoom.creatorId.toString() === userId;
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (!isRoomAdmin && !isCreator && !isAdmin) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền quản lý phân quyền cho nhóm này."
        });
      }

      // 3. Cập nhật quyền của từng thành viên
      if (Array.isArray(members)) {
        for (const item of members) {
          const idx = chatRoom.members.findIndex(m => m.userId.toString() === item.userId);
          if (idx !== -1) {
            chatRoom.members[idx].canUploadDrive = !!item.canUploadDrive;
          }
        }
      }

      // 4. Cập nhật quyền truy cập chung
      if (driveGeneralAccess && ["restricted", "company"].includes(driveGeneralAccess)) {
        chatRoom.driveGeneralAccess = driveGeneralAccess;
      }

      await chatRoom.save();

      // Populate thông tin người dùng trước khi phản hồi về Client
      const populatedChatRoom = await ChatRoomModel.findById(chatRoom._id)
        .populate("members.userId", "displayName photoURL email role status");

      return res.status(200).json({
        status: "success",
        message: "Cập nhật cấu hình phân quyền Google Drive nhóm thành công.",
        data: {
          driveGeneralAccess: chatRoom.driveGeneralAccess,
          members: populatedChatRoom?.members || []
        }
      });
    } catch (error: any) {
      console.error("[googleDriveController.updateGroupPermissions] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Cập nhật phân quyền thất bại.",
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
        $or: [
          { _id: /^[0-9a-fA-F]{24}$/.test(resourceId) ? resourceId : undefined },
          { driveFileId: resourceId }
        ].filter(Boolean) as any,
        companyCode
      });

      let driveFileIdToDelete = resourceId;
      let uploadedByUserId = userId;
      let chatRoomId = "";

      if (resource) {
        driveFileIdToDelete = resource.driveFileId;
        uploadedByUserId = resource.uploadedBy ? resource.uploadedBy.toString() : "";
        chatRoomId = resource.chatRoomId ? resource.chatRoomId.toString() : "";
      }

      // Kiểm tra quyền xóa:
      // Nếu là tài nguyên cá nhân (không có chatRoomId): người upload mới được xóa.
      // Nếu là tài nguyên nhóm (có chatRoomId): người upload, admin phòng chat đó, hoặc Admin/Super Admin hệ thống được xóa.
      let isAllowed = false;
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (isAdmin) {
        isAllowed = true;
      } else if (uploadedByUserId === userId) {
        isAllowed = true;
      } else if (chatRoomId) {
        const chatRoom = await ChatRoomModel.findOne({ _id: chatRoomId, companyCode });
        if (chatRoom) {
          const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
          const isRoomAdmin = memberInfo?.role === "admin";
          const isCreator = chatRoom.creatorId.toString() === userId;
          if (isRoomAdmin || isCreator) {
            isAllowed = true;
          }
        }
      } else {
        // Tài nguyên không có trong DB và không thuộc phòng nhóm nào -> cho phép chủ tài khoản drive xóa
        isAllowed = true;
      }

      if (!isAllowed) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền xóa tài nguyên này.",
        });
      }

      // Xóa trên Google Drive
      try {
        let authClient;
        if (chatRoomId) {
          const adminInfo = await getAdminDriveClient(companyCode, req.user?.id);
          authClient = adminInfo.authClient;
        } else {
          const driveInfo = await getDriveClientAndRoot(companyCode, uploadedByUserId);
          if (driveInfo.isConnected) {
            authClient = driveInfo.authClient;
          } else {
            authClient = await GoogleDriveService.getClientForUser(uploadedByUserId);
          }
        }
        await GoogleDriveService.deleteFile(authClient, driveFileIdToDelete);
      } catch (err: any) {
        // Log và cho phép xóa tiếp ở DB nếu file đã bị xóa trên Drive thủ công từ trước
        console.warn(`[googleDriveController.deleteResource] File không tìm thấy trên Drive hoặc không thể xóa:`, err.message);
      }

      // Xóa trong local DB
      if (resource) {
        await resource.deleteOne();
      }

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

  /**
   * POST /api/v1/integrations/google-drive/resources/move
   * Di chuyển tệp tin hoặc thư mục trên Google Drive và cập nhật database
   */
  async moveResource(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { fileId, newParentId, spaceType, roomId } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (!fileId || !newParentId) {
        return res.status(400).json({ status: "error", message: "Thiếu thông tin tệp (fileId) hoặc thư mục đích (newParentId)." });
      }

      // 1. Tìm tài nguyên trong database
      const resource = await ResourceModel.findOne({
        $or: [
          { _id: fileId.match(/^[0-9a-fA-F]{24}$/) ? fileId : undefined },
          { driveFileId: fileId }
        ].filter(Boolean) as any
      });

      // Kiểm tra quyền di chuyển tài nguyên nguồn và quyền tại thư mục đích
      let isAllowedSource = false;
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (isAdmin) {
        isAllowedSource = true;
      } else if (resource && resource.uploadedBy.toString() === userId) {
        isAllowedSource = true;
      } else if (resource && resource.chatRoomId) {
        const chatRoom = await ChatRoomModel.findOne({ _id: resource.chatRoomId, companyCode });
        if (chatRoom) {
          const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
          const isRoomAdmin = memberInfo?.role === "admin";
          const isCreator = chatRoom.creatorId.toString() === userId;
          const isUploader = memberInfo?.canUploadDrive === true;
          if (isRoomAdmin || isCreator || isUploader) {
            isAllowedSource = true;
          }
        }
      } else if (!resource) {
        isAllowedSource = true;
      }

      let isAllowedDest = false;
      if (spaceType === "group" && roomId) {
        const chatRoom = await ChatRoomModel.findOne({ _id: roomId, companyCode });
        if (chatRoom) {
          const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
          const isRoomAdmin = memberInfo?.role === "admin";
          const isCreator = chatRoom.creatorId.toString() === userId;
          const isUploader = memberInfo?.canUploadDrive === true;
          if (isRoomAdmin || isCreator || isUploader || isAdmin) {
            isAllowedDest = true;
          }
        }
      } else {
        isAllowedDest = true;
      }

      if (!isAllowedSource || !isAllowedDest) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền di chuyển tài nguyên này."
        });
      }

      const actualDriveFileId = resource ? resource.driveFileId : fileId;

      // 2. Xác định client xác thực dựa trên không gian nguồn
      let authClient;
      if (resource && resource.chatRoomId) {
        const adminInfo = await getAdminDriveClient(companyCode, req.user?.id);
        authClient = adminInfo.authClient;
      } else {
        const driveInfo = await getDriveClientAndRoot(companyCode, userId);
        if (driveInfo.isConnected) {
          authClient = driveInfo.authClient;
        } else {
          authClient = await GoogleDriveService.getClientForUser(userId);
        }
      }

      const drive = google.drive({ version: "v3", auth: authClient });

      // 3. Lấy thông tin tệp trên Google Drive để tìm các parents hiện tại
      const driveFile = await drive.files.get({
        fileId: actualDriveFileId,
        fields: "parents"
      });

      const previousParents = driveFile.data.parents?.join(",") || "";

      // 4. Di chuyển trên Google Drive
      await drive.files.update({
        fileId: actualDriveFileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: "id, parents"
      });

      // 5. Nếu tìm thấy tài nguyên trong DB, cập nhật lại không gian lưu trữ và roomId
      if (resource) {
        if (spaceType === "group" && roomId) {
          resource.chatRoomId = roomId;
        } else {
          resource.chatRoomId = undefined as any;
        }
        await resource.save();
      }

      return res.status(200).json({
        status: "success",
        message: "Di chuyển tài nguyên thành công."
      });
    } catch (error: any) {
      console.error("[googleDriveController.moveResource] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Di chuyển tài nguyên thất bại.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/integrations/google-drive/create-file
   * Tạo tệp Google Tài liệu, Trang tính, Trang trình bày, Thư mục hoặc Liên kết mới
   */
  async createFile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { spaceType, roomId, type, name, linkUrl, folderId } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (!type || !name) {
        return res.status(400).json({ status: "error", message: "Thiếu thông tin loại tệp (type) hoặc tên tệp (name)." });
      }

      // 1. Xác thực quyền sở hữu/truy cập không gian
      let parentId = "";
      let authClient;
      let chatRoom: any;

      if (spaceType === "group") {
        if (!roomId) {
          return res.status(400).json({ status: "error", message: "Thiếu thông tin roomId cho không gian nhóm." });
        }
        chatRoom = await ChatRoomModel.findOne({ _id: roomId, companyCode });
        if (!chatRoom) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy phòng chat." });
        }

        // Kiểm tra quyền (phải là Uploader hoặc Admin phòng, hoặc Admin hệ thống)
        const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
        const isUploader = memberInfo?.canUploadDrive === true;
        const isRoomAdmin = memberInfo?.role === "admin";
        const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

        if (!isUploader && !isRoomAdmin && !isAdmin) {
          return res.status(403).json({
            status: "error",
            message: "Bạn không có quyền thêm tài liệu vào nhóm này."
          });
        }

        // Khởi tạo thư mục nhóm nếu chưa có
        if (!chatRoom.driveFolderId) {
          const adminInfo = await getAdminDriveClient(companyCode, req.user?.id);
          const sharedGroupsFolderId = await GoogleDriveService.createFolder(adminInfo.authClient, "iGen Shared Groups");
          const drive = google.drive({ version: "v3", auth: adminInfo.authClient });
          const folder = await drive.files.create({
            requestBody: {
              name: chatRoom.name || `Nhóm_${roomId}`,
              mimeType: "application/vnd.google-apps.folder",
              parents: [sharedGroupsFolderId]
            },
            fields: "id"
          });
          
          try {
            await drive.permissions.create({
              fileId: folder.data.id!,
              requestBody: { role: "reader", type: "anyone" }
            });
          } catch (err: any) {
            console.warn("Không thể thiết lập quyền công khai cho thư mục nhóm:", err.message);
          }

          chatRoom.driveFolderId = folder.data.id!;
          await chatRoom.save();
        }

        parentId = (folderId && folderId !== "root" && folderId !== roomId) ? folderId : chatRoom.driveFolderId;
        const adminInfo = await getAdminDriveClient(companyCode, req.user?.id);
        authClient = adminInfo.authClient;
      } else {
        // Cá nhân
        let targetUserId = userId;
        if ((req.user?.role === "admin" || req.user?.role === "superadmin") && req.body.ownerId) {
          targetUserId = req.body.ownerId;
        }
        const user = await UserModel.findById(targetUserId);
        if (!user) {
          return res.status(400).json({ status: "error", message: "Không tìm thấy người dùng." });
        }
        const driveInfo = await getDriveClientAndRoot(user.companyCode || companyCode, targetUserId);
        if (!driveInfo.isConnected) {
          return res.status(400).json({ status: "error", message: "Tài khoản chưa kết nối Google Drive." });
        }
        // Chặn truy cập chéo công ty: chỉ superadmin mới được thay mặt user ngoài công ty của mình
        if (user && !canAccessPersonalDriveTarget({
          callerId: req.user?.id,
          callerRole: req.user?.role,
          callerCompanyCode: companyCode,
          targetUserId,
          targetCompanyCode: user.companyCode,
        })) {
          return res.status(403).json({ status: "error", message: "Bạn không có quyền thao tác trên tài nguyên của người dùng này." });
        }
        parentId = (folderId && folderId !== "root" && folderId !== "personal") ? folderId : driveInfo.rootFolderId;
        authClient = driveInfo.authClient;
      }

      // 2. Xử lý tạo tệp theo loại
      const drive = google.drive({ version: "v3", auth: authClient });
      let driveFileId = "";
      let webViewLink = "";
      let mimeType = "";
      let size = 0;

      if (type === "link") {
        if (!linkUrl) {
          return res.status(400).json({ status: "error", message: "Thiếu đường dẫn liên kết (linkUrl)." });
        }
        
        // Kiểm tra xem có phải link Google Drive không
        const driveRegex = /(?:drive\.google\.com\/file\/d\/|open\?id=|docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/)([a-zA-Z0-9-_]+)/;
        const match = linkUrl.match(driveRegex);
        
        if (match && match[1]) {
          const fileId = match[1];
          try {
            const driveFile = await drive.files.get({
              fileId,
              fields: "id, name, mimeType, webViewLink, size"
            });
            driveFileId = driveFile.data.id!;
            webViewLink = driveFile.data.webViewLink!;
            mimeType = driveFile.data.mimeType!;
            size = driveFile.data.size ? parseInt(String(driveFile.data.size), 10) : 0;
          } catch (err: any) {
            return res.status(400).json({
              status: "error",
              message: "Không thể lấy thông tin tệp từ đường link Google Drive này. Hãy đảm bảo tệp đã được mở quyền chia sẻ công khai.",
              details: err.message
            });
          }
        } else {
          // Link ngoài -> lưu trực tiếp vào DB, không qua Google Drive API
          driveFileId = "link-" + Date.now();
          webViewLink = linkUrl;
          mimeType = "text/html";
        }
      } else {
        // Tạo thư mục hoặc tệp Google Docs/Sheets/Slides
        let targetMimeType = "";
        if (type === "folder") {
          targetMimeType = "application/vnd.google-apps.folder";
        } else if (type === "document") {
          targetMimeType = "application/vnd.google-apps.document";
        } else if (type === "spreadsheet") {
          targetMimeType = "application/vnd.google-apps.spreadsheet";
        } else if (type === "presentation") {
          targetMimeType = "application/vnd.google-apps.presentation";
        }

        let createdFile;
        let actualParentId = parentId;
        try {
          const fileMetadata: any = {
            name,
            mimeType: targetMimeType,
          };
          if (actualParentId) {
            fileMetadata.parents = [actualParentId];
          }

          createdFile = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id, name, mimeType, webViewLink"
          });
        } catch (createErr: any) {
          const isPermissionOrNotFound = createErr.status === 403 || createErr.status === 404 || 
            (createErr.message && (createErr.message.includes("Insufficient permissions") || createErr.message.includes("not found")));

          if (isPermissionOrNotFound && spaceType === "group" && actualParentId === chatRoom.driveFolderId) {
            console.warn("[createFile] Thư mục cha không hợp lệ hoặc thiếu quyền. Tiến hành khởi tạo lại thư mục mới...");
            try {
              const sharedGroupsFolderId = await GoogleDriveService.createFolder(authClient, "iGen Shared Groups");
              const newFolder = await drive.files.create({
                requestBody: {
                  name: chatRoom.name || `Nhóm_${roomId}`,
                  mimeType: "application/vnd.google-apps.folder",
                  parents: [sharedGroupsFolderId]
                },
                fields: "id"
              });
              
              try {
                await drive.permissions.create({
                  fileId: newFolder.data.id!,
                  requestBody: { role: "reader", type: "anyone" }
                });
              } catch (permErr: any) {
                console.warn("Không thể thiết lập quyền công khai cho thư mục nhóm mới:", permErr.message);
              }

              chatRoom.driveFolderId = newFolder.data.id!;
              await chatRoom.save();
              actualParentId = chatRoom.driveFolderId;

              const fileMetadata: any = {
                name,
                mimeType: targetMimeType,
              };
              fileMetadata.parents = [actualParentId];

              createdFile = await drive.files.create({
                requestBody: fileMetadata,
                fields: "id, name, mimeType, webViewLink"
              });
            } catch (recreateErr: any) {
              console.error("[createFile] Khôi phục thư mục và tạo tệp lại thất bại:", recreateErr);
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }

        driveFileId = createdFile.data.id!;
        webViewLink = createdFile.data.webViewLink || (
          type === "folder" 
            ? `https://drive.google.com/drive/folders/${createdFile.data.id}` 
            : `https://docs.google.com/open?id=${createdFile.data.id}`
        );
        mimeType = createdFile.data.mimeType!;

        // Cấp quyền đọc công khai
        try {
          await drive.permissions.create({
            fileId: driveFileId,
            requestBody: { role: "reader", type: "anyone" }
          });
        } catch (err: any) {
          console.warn("Không thể thiết lập quyền công khai cho tệp mới:", err.message);
        }
      }

      // 3. Lưu vào Database
      const resource = await ResourceModel.create({
        companyCode,
        uploadedBy: ((req.user?.role === "admin" || req.user?.role === "superadmin") && req.body.ownerId) ? req.body.ownerId : userId,
        name,
        mimeType,
        driveFileId,
        webViewLink,
        size,
        chatRoomId: spaceType === "group" ? roomId : undefined
      });

      return res.status(200).json({
        status: "success",
        message: "Tạo tài nguyên mới thành công.",
        data: resource
      });
    } catch (error: any) {
      console.error("[googleDriveController.createFile] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi tạo tài nguyên mới.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/integrations/google-drive/resources/:id/rename
   * Đổi tên tệp tin hoặc thư mục trên Google Drive và cập nhật database
   */
  async renameResource(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { id } = req.params;
      const { name } = req.body;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ status: "error", message: "Tên mới không được để trống." });
      }

      // Tìm tài nguyên trong database
      const resource = await ResourceModel.findOne({
        $or: [
          { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : undefined },
          { driveFileId: id }
        ].filter(Boolean) as any
      });

      if (!resource) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy tài nguyên." });
      }

      // Kiểm tra quyền đổi tên tài nguyên
      let isAllowed = false;
      const isAdmin = ["admin", "superadmin"].includes(req.user?.role || "");

      if (isAdmin) {
        isAllowed = true;
      } else if (resource.uploadedBy.toString() === userId) {
        isAllowed = true;
      } else if (resource.chatRoomId) {
        const chatRoom = await ChatRoomModel.findOne({ _id: resource.chatRoomId, companyCode });
        if (chatRoom) {
          const memberInfo = chatRoom.members.find(m => m.userId.toString() === userId);
          const isRoomAdmin = memberInfo?.role === "admin";
          const isCreator = chatRoom.creatorId.toString() === userId;
          const isUploader = memberInfo?.canUploadDrive === true;
          if (isRoomAdmin || isCreator || isUploader) {
            isAllowed = true;
          }
        }
      } else {
        if (resource.uploadedBy.toString() === userId) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền chỉnh sửa tài nguyên này.",
        });
      }

      // Xác định client xác thực
      let authClient;
      if (resource.chatRoomId) {
        const adminInfo = await getAdminDriveClient(companyCode);
        authClient = adminInfo.authClient;
      } else {
        const driveInfo = await getDriveClientAndRoot(companyCode, userId);
        if (driveInfo.isConnected) {
          authClient = driveInfo.authClient;
        } else {
          authClient = await GoogleDriveService.getClientForUser(userId);
        }
      }

      const drive = google.drive({ version: "v3", auth: authClient });

      // Cập nhật tên trên Google Drive
      await drive.files.update({
        fileId: resource.driveFileId,
        requestBody: { name: name.trim() },
        fields: "id, name"
      });

      // Cập nhật tên trong database
      resource.name = name.trim();
      await resource.save();

      return res.status(200).json({
        status: "success",
        message: "Đổi tên thành công.",
        data: resource
      });
    } catch (error: any) {
      console.error("[googleDriveController.renameResource] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Đổi tên thất bại.",
        details: error.message,
      });
    }
  },
};
