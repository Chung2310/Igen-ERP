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
      const redirectUri = `${req.protocol}://${req.get("host")}/api/v1/facebook/oauth-callback`;
      const pages = await facebookPostService.exchangeCodeForPages(String(code), redirectUri);

      // Trả về HTML chứa script postMessage gửi dữ liệu về cho cửa sổ cha (parent window)
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Facebook Login Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 50px; background-color: #f3f4f6; color: #1f2937; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: inline-block; max-width: 400px; }
            h2 { color: #1877F2; margin-top: 0; }
            .spinner { border: 4px solid rgba(0, 0, 0, 0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #1877F2; animation: spin 1s linear infinite; display: inline-block; margin-top: 15px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Đăng nhập thành công!</h2>
            <p>Đang đồng bộ hóa danh sách Fanpage của bạn về hệ thống ERP...</p>
            <div class="spinner"></div>
          </div>
          <script>
            try {
              const pages = ${JSON.stringify(pages)};
              window.opener.postMessage({
                type: 'FACEBOOK_OAUTH_SUCCESS',
                pages: pages
              }, '*');
            } catch (err) {
              console.error('Error postMessage to opener:', err);
              window.opener.postMessage({
                type: 'FACEBOOK_OAUTH_FAILED',
                error: err.message
              }, '*');
            }
            setTimeout(() => window.close(), 1500);
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
            window.opener.postMessage({
              type: 'FACEBOOK_OAUTH_FAILED',
              error: '${err.message}'
            }, '*');
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
        </html>
      `);
    }
  },
};
