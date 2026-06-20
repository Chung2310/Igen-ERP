import { Request, Response } from "express";
import { facebookPostService } from "../service/facebook-post.service";

export const facebookPostController = {
  /**
   * POST /api/v1/facebook/publish
   */
  async publish(req: Request, res: Response) {
    try {
      const { content, imageUrl, videoUrl, pageId, accessToken } = req.body;
      const result = await facebookPostService.publishToPage(
        content,
        imageUrl,
        videoUrl,
        pageId,
        accessToken
      );
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[facebookPostController.publish] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý đăng bài lên Facebook qua n8n",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/facebook/validate-token
   */
  async validateToken(req: Request, res: Response) {
    try {
      const { pageId, accessToken } = req.body;
      const result = await facebookPostService.validateToken(pageId, accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[facebookPostController.validateToken] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý xác thực token liên kết Facebook qua n8n",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/facebook/login-credentials
   */
  async loginWithCredentials(req: Request, res: Response) {
    try {
      const { email, password, pageId } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          status: "error",
          message: "Vui lòng nhập đầy đủ tài khoản và mật khẩu Facebook."
        });
      }
      const result = await facebookPostService.loginWithCredentials(email, password, pageId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[facebookPostController.loginWithCredentials] Error:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "Gặp lỗi khi xử lý đăng nhập bằng tài khoản Facebook.",
      });
    }
  },

  /**
   * GET /api/v1/facebook/oauth-callback
   */
  async oauthCallback(req: Request, res: Response) {
    try {
      const { code, error, error_description } = req.query;
      if (error) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Facebook Login Failed</title></head>
          <body>
            <h2>Kết nối Facebook thất bại</h2>
            <p>Chi tiết lỗi: ${error_description || error}</p>
            <script>
              window.opener.postMessage({
                type: 'FACEBOOK_OAUTH_FAILED',
                error: '${error_description || error}'
              }, '*');
              setTimeout(() => window.close(), 5000);
            </script>
          </body>
          </html>
        `);
      }

      if (!code) {
        return res.status(400).send("Không tìm thấy mã authorization code từ Facebook.");
      }

      // Lấy URI tự động dựa trên giao thức và host hiện tại của server
      // Nếu host không phải localhost/127.0.0.1, bắt buộc dùng https vì Facebook chỉ hỗ trợ HTTPS cho production
      const host = req.get("host") || "";
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("192.168.");
      const protocol = isLocal ? req.protocol : "https";
      const redirectUri = `${protocol}://${host}/api/v1/facebook/oauth-callback`;
      const pages = await facebookPostService.exchangeCodeForPages(String(code), redirectUri);

      // Trả về HTML hiển thị danh sách page để user chọn
      return res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Chọn Fanpage Facebook</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: linear-gradient(135deg, #1877F2 0%, #0d5bc4 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              width: 100%;
              max-width: 480px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #1877F2 0%, #0d5bc4 100%);
              padding: 24px;
              text-align: center;
              color: white;
            }
            .fb-logo {
              width: 48px; height: 48px;
              background: white;
              border-radius: 50%;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 12px;
              font-size: 28px;
              font-weight: 900;
              color: #1877F2;
            }
            .header h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
            .header p { font-size: 13px; opacity: 0.85; }
            .pages-list { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
            .page-card {
              display: flex;
              align-items: center;
              gap: 14px;
              padding: 14px 16px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              cursor: pointer;
              transition: all 0.2s ease;
              background: white;
              text-align: left;
              width: 100%;
            }
            .page-card:hover {
              border-color: #1877F2;
              background: #f0f4ff;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(24,119,242,0.2);
            }
            .page-avatar {
              width: 48px; height: 48px;
              border-radius: 50%;
              background: linear-gradient(135deg, #1877F2, #42a5f5);
              display: flex; align-items: center; justify-content: center;
              color: white; font-size: 22px; font-weight: 700;
              flex-shrink: 0;
            }
            .page-info { flex: 1; overflow: hidden; }
            .page-name {
              font-size: 15px; font-weight: 600;
              color: #111827;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .page-id { font-size: 12px; color: #6b7280; margin-top: 2px; }
            .page-category { font-size: 12px; color: #1877F2; margin-top: 2px; }
            .arrow { color: #9ca3af; font-size: 18px; }
            .empty {
              text-align: center; padding: 40px 20px; color: #6b7280;
            }
            .empty-icon { font-size: 48px; margin-bottom: 12px; }
            .footer {
              padding: 16px 20px;
              border-top: 1px solid #f3f4f6;
              text-align: center;
              font-size: 12px;
              color: #9ca3af;
            }
            .loading { text-align: center; padding: 40px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="fb-logo">f</div>
              <h2>Chọn Fanpage để kết nối</h2>
              <p>Chọn một Fanpage bạn muốn tích hợp vào iGen ERP</p>
            </div>
            <div class="pages-list" id="pagesList">
              ${(pages as any[]).length === 0 ? `
                <div class="empty">
                  <div class="empty-icon">📭</div>
                  <p>Tài khoản của bạn chưa quản lý Fanpage nào.</p>
                </div>
              ` : (pages as any[]).map((p: any) => `
                <button class="page-card" onclick="selectPage(${JSON.stringify(JSON.stringify(p))})">
                  <div class="page-avatar">${(p.name || 'P')[0].toUpperCase()}</div>
                  <div class="page-info">
                    <div class="page-name">${p.name || 'Facebook Page'}</div>
                    <div class="page-id">ID: ${p.id}</div>
                    ${p.category ? `<div class="page-category">${p.category}</div>` : ''}
                  </div>
                  <span class="arrow">›</span>
                </button>
              `).join('')}
            </div>
            <div class="footer">Dữ liệu được mã hóa và lưu trữ an toàn</div>
          </div>
          <script>
            function selectPage(pageJsonStr) {
              try {
                const page = JSON.parse(pageJsonStr);
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'FACEBOOK_PAGE_SELECTED',
                    page: page
                  }, '*');
                }
                setTimeout(() => window.close(), 300);
              } catch(err) {
                alert('Lỗi: ' + err.message);
              }
            }
          </script>
        </body>
        </html>
      `);
    } catch (err: any) {
      console.error("[facebookPostController.oauthCallback] Error:", err);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Facebook Login Error</title></head>
        <body>
          <h2>Lỗi hệ thống khi xử lý kết nối Facebook</h2>
          <p>${err.message}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'FACEBOOK_OAUTH_FAILED',
                error: '${err.message.replace(/'/g, "\\'")}'
              }, '*');
            }
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
        </html>
      `);
    }
  },

  /**
   * GET /api/v1/facebook/config
   */
  async getConfig(req: Request, res: Response) {
    return res.status(200).json({
      status: "success",
      appId: process.env.FB_APP_ID || "1022427163587456"
    });
  },
};
