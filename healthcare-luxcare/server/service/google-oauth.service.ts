import { OAuth2Client } from "google-auth-library";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];
const CALLBACK_PATH = "/api/v1/auth/companies/drive/oauth-callback";
const STATE_TTL_SECONDS = 10 * 60;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  appOrigin: string;
  redirectUri: string;
}

export interface CompanyDriveOAuthState {
  companyCode: string;
  initiatedBy: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const rawAppUrl = process.env.APP_URL?.trim();
  if (!clientId) throw new Error("Thiếu GOOGLE_OAUTH_CLIENT_ID.");
  if (!clientSecret) throw new Error("Thiếu GOOGLE_OAUTH_CLIENT_SECRET.");
  if (!rawAppUrl) throw new Error("Thiếu APP_URL.");

  let parsed: URL;
  try {
    parsed = new URL(rawAppUrl);
  } catch {
    throw new Error("APP_URL không phải URL hợp lệ.");
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.pathname.replace(/\/+$/, "") || parsed.search || parsed.hash) {
    throw new Error("APP_URL phải chỉ gồm origin, không chứa path, query hoặc fragment.");
  }

  const appUrl = parsed.origin;
  return {
    clientId,
    clientSecret,
    appUrl,
    appOrigin: parsed.origin,
    redirectUri: `${appUrl}${CALLBACK_PATH}`,
  };
}

export function buildGoogleDriveRedirectUri(): string {
  return getGoogleOAuthConfig().redirectUri;
}

function signState(encodedPayload: string): Buffer {
  const { clientSecret } = getGoogleOAuthConfig();
  return createHmac("sha256", `company-drive-state:${clientSecret}`).update(encodedPayload).digest();
}

export function createCompanyDriveOAuthState(
  input: Pick<CompanyDriveOAuthState, "companyCode" | "initiatedBy">,
  now = Math.floor(Date.now() / 1000),
): string {
  const payload: CompanyDriveOAuthState = {
    companyCode: input.companyCode.trim().toUpperCase(),
    initiatedBy: input.initiatedBy,
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: now,
    expiresAt: now + STATE_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signState(encodedPayload).toString("base64url")}`;
}

export function verifyCompanyDriveOAuthState(
  state: string,
  now = Math.floor(Date.now() / 1000),
): CompanyDriveOAuthState {
  const [encodedPayload, encodedSignature, extra] = state.split(".");
  if (!encodedPayload || !encodedSignature || extra) throw new Error("OAuth state không hợp lệ.");

  const actualSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = signState(encodedPayload);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error("OAuth state không hợp lệ.");
  }

  let payload: Partial<CompanyDriveOAuthState>;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new Error("OAuth state không hợp lệ.");
  }
  if (
    typeof payload.companyCode !== "string" ||
    !payload.companyCode ||
    typeof payload.initiatedBy !== "string" ||
    !payload.initiatedBy ||
    typeof payload.nonce !== "string" ||
    !payload.nonce ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number"
  ) {
    throw new Error("OAuth state không hợp lệ.");
  }
  if (payload.expiresAt < now) throw new Error("OAuth state đã hết hạn.");
  return payload as CompanyDriveOAuthState;
}

export const googleOAuthService = {
  isConfigured(): boolean {
    try {
      getGoogleOAuthConfig();
      return true;
    } catch {
      return false;
    }
  },

  buildAuthUrl(state: string): string {
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account consent",
      scope: SCOPES,
      state,
      include_granted_scopes: true,
    });
  },

  async exchangeCode(code: string): Promise<{ refreshToken: string; email: string }> {
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        "Google không trả về refresh token. Hãy thu hồi quyền ứng dụng trong tài khoản Google rồi kết nối lại.",
      );
    }
    const email = tokens.access_token ? await this.getEmail(tokens.access_token) : "";
    return { refreshToken: tokens.refresh_token, email };
  },

  async getAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = getGoogleOAuthConfig();
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials({ refresh_token: refreshToken });
    try {
      const { token } = await client.getAccessToken();
      if (!token) throw new Error("missing_access_token");
      return token;
    } catch (error: any) {
      if (error?.response?.data?.error === "invalid_grant" || error?.message === "invalid_grant") {
        throw new Error("Phiên Google Drive đã hết hiệu lực. Vui lòng kết nối lại Google Drive trong Cài đặt.");
      }
      throw error;
    }
  },

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
