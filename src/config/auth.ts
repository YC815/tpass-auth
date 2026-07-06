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
  "AUTH_SERVICE_IDS",
  "PORTAL_URL",
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
    // v1（遷移期）：跨子網域共用 cookie。所有消費端切到 v2 後停發（AUTH_ISSUE_LEGACY_COOKIE=0）。
    name: process.env.AUTH_COOKIE_NAME!,
    // dev 留空＝host-only（localhost 才跑得動）；非空才設 Domain（未來跨子網域）。
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    // 由 origin 是否為 https 推導 Secure：localhost(http) 不設，正式(https) 必設。
    secure: baseUrl.startsWith("https://"),
  },
  // v2：auth 自己的登入態，host-only（不設 Domain）——只有 auth 網域收得到，
  // 縮小外洩半徑：任何子網域被攻破都拿不到這顆 cookie。
  sessionCookieName: "tpass_auth_session",
  // v2：可申請 per-service token 的服務 id 白名單（逗號分隔，例 portal,form,msg,appeals）。
  // 每個服務拿到的 token aud=tpass:<id>，只在該服務有效——單一服務被攻破不再等於全生態淪陷。
  serviceIds: process.env.AUTH_SERVICE_IDS!.split(",").map((s) => s.trim()).filter(Boolean),
  // 遷移旗標：預設同時簽發 v1 共用 cookie（相容未升級消費端）；全數升級後設 0 停發。
  issueLegacyCookie: process.env.AUTH_ISSUE_LEGACY_COOKIE !== "0",
  // redirect_uri 白名單的根網域。比對時用 host === base || host.endsWith('.'+base)。
  allowedHostSuffix: process.env.AUTH_ALLOWED_HOST_SUFFIX!,
  // 只放行此 email 網域（不含 @）。
  allowedEmailDomain: process.env.AUTH_ALLOWED_EMAIL_DOMAIN!.toLowerCase(),
  // 門戶大廳網址。auth 本身不是使用者的目的地——被單獨訪問（沒帶 redirect_uri）時，
  // 登入完就把人送回門戶，而不是停在 auth 自己頁面。env 驅動，絕不寫死網域。
  portalUrl: process.env.PORTAL_URL!,
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
