// 設定中心：所有可變設定一律從這裡讀（process.env）。
// 換驗證對象 / 上線開跨子網域 = 只改環境變數，其他檔案只 import 這個物件。
import "server-only";

// 必填 env：缺任何一個就在啟動時明確報出，不默默用 undefined 跑下去。
const REQUIRED = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_BASE_URL",
  "AUTH_COOKIE_NAME",
  "AUTH_ALLOWED_HOST_SUFFIX",
  "AUTH_ALLOWED_EMAIL_DOMAIN",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "JWT_TTL_SECONDS",
] as const;

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `[config/auth] 缺少必填環境變數：${missing.join(", ")}（請檢查 .env.local）`,
  );
}

// 簽章金鑰只有一把，固定 kid；未來輪替金鑰時子網域才認得出是哪一把。
const KID = "tpass-key-1";

const baseUrl = process.env.AUTH_BASE_URL!;

export const authConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // Google Cloud 後台登記的 redirect URI 必須與此完全一致。
    redirectUri: `${baseUrl}/api/auth/callback/google`,
  },
  baseUrl,
  cookie: {
    name: process.env.AUTH_COOKIE_NAME!,
    // dev 留空＝host-only（localhost 才跑得動）；非空才設 Domain（未來跨子網域）。
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    // 由 origin 是否為 https 推導 Secure：localhost(http) 不設，正式(https) 必設。
    secure: baseUrl.startsWith("https://"),
  },
  // redirect_uri 白名單的根網域。比對時用 host === base || host.endsWith('.'+base)。
  allowedHostSuffix: process.env.AUTH_ALLOWED_HOST_SUFFIX!,
  // 只放行此 email 網域（不含 @）。
  allowedEmailDomain: process.env.AUTH_ALLOWED_EMAIL_DOMAIN!.toLowerCase(),
  jwt: {
    privateKeyPem: process.env.JWT_PRIVATE_KEY!,
    publicKeyPem: process.env.JWT_PUBLIC_KEY!,
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
    ttlSeconds: Number(process.env.JWT_TTL_SECONDS!),
    kid: KID,
  },
} as const;

export type AuthConfig = typeof authConfig;
