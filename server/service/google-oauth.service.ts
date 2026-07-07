/**
 * Google OAuth Service (per-company)
 * ──────────────────────────────────
 * Mỗi công ty kết nối tài khoản Google Drive của riêng họ qua OAuth 2.0.
 * App chỉ giữ MỘT OAuth client trong .env (không phải mỗi công ty một credential):
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 *
 * Scope drive.file (không bị Google xếp vào "restricted" nên không cần verify gắt):
 * app chỉ truy cập các file/thư mục do chính app tạo trong Drive của người dùng.
 * → App tự tạo một thư mục riêng cho công ty và upload tài liệu vào đó.
 *
 * Redirect URI phải được khai báo trong Google Cloud Console:
 *   <APP_URL>/api/v1/auth/companies/drive/oauth-callback
 */

import { OAuth2Client } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Chưa cấu hình Google OAuth. Vui lòng đặt GOOGLE_OAUTH_CLIENT_ID và GOOGLE_OAUTH_CLIENT_SECRET trong .env."
    );
  }
  return { clientId, clientSecret };
}

export const googleOAuthService = {
  isConfigured(): boolean {
    return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  },

  /** Tạo URL đồng ý OAuth để mở popup. state = companyCode. */
  buildAuthUrl(redirectUri: string, state: string): string {
    const { clientId, clientSecret } = getClientCredentials();
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    return client.generateAuthUrl({
      access_type: "offline", // để nhận refresh_token
      prompt: "consent", // luôn xin lại refresh_token
      scope: SCOPES,
      state,
      include_granted_scopes: true,
    });
  },

  /** Đổi authorization code lấy refresh token + email. */
  async exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string; email: string }> {
    const { clientId, clientSecret } = getClientCredentials();
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google không trả về refresh token. Hãy thử ngắt kết nối ứng dụng trong tài khoản Google rồi kết nối lại."
      );
    }
    let email = "";
    if (tokens.access_token) {
      email = await this.getEmail(tokens.access_token);
    }
    return { refreshToken: tokens.refresh_token, email };
  },

  /** Lấy access token mới từ refresh token của công ty. */
  async getAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = getClientCredentials();
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials({ refresh_token: refreshToken });
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error("Không lấy được access token Google. Có thể cần kết nối lại Google Drive trong Cài đặt.");
    }
    return token;
  },

  /** Lấy email tài khoản Google từ access token. */
  async getEmail(accessToken: string): Promise<string> {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { email?: string };
      return data.email || "";
    } catch {
      return "";
    }
  },
};
