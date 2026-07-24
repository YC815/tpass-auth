// 設定中心：所有可變設定一律從這裡讀（process.env）。
// 換驗證對象 / 上線開跨子網域 = 只改環境變數，其他檔案只 import 這個物件。
import "server-only";

// 必填 env：缺任何一個就在啟動時明確報出，不默默用 undefined 跑下去。
const REQUIRED = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_BASE_URL",
  "AUTH_ALLOWED_HOST_SUFFIX",
  "AUTH_ALLOWED_EMAIL_DOMAIN",
  "AUTH_SERVICE_IDS",
  "PORTAL_URL",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "JWT_ISSUER",
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

// 授權群組設定（簡易版）：一份唯讀 env（AUTH_GROUPS，JSON），型別 email → { serviceId: groups[] }。
//   例：{"alice@tschool...": {"form": ["admin","super-admin"], "appeals": ["admin"]}}
// 這是「中央管會員、各服務本地授權」的中央那份；未來要圖形管理台時改由 directory 服務餵入，
// 消費端與 token 格式都不動（見 docs 計畫）。缺省＝沒有人有任何群組（非管理員）。
type GroupMap = Record<string, Record<string, string[]>>;
function parseGroups(raw: string | undefined): GroupMap {
  if (!raw || !raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("[config/auth] AUTH_GROUPS 不是合法 JSON（email → { serviceId: string[] }）");
  }
  const out: GroupMap = {};
  for (const [email, perService] of Object.entries(parsed as GroupMap)) {
    out[email.toLowerCase()] = perService;
  }
  return out;
}

export const authConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // Google Cloud 後台登記的 redirect URI 必須與此完全一致。
    redirectUri: `${baseUrl}/api/auth/callback/google`,
  },
  baseUrl,
  // 由 origin 是否為 https 推導 Secure：localhost(http) 不設，正式(https) 必設。
  // 所有 cookie（auth 自己的 session、OAuth state 暫存）共用這個推導值。
  cookieSecure: baseUrl.startsWith("https://"),
  // v2：auth 自己的登入態，host-only（不設 Domain）——只有 auth 網域收得到，
  // 縮小外洩半徑：任何子網域被攻破都拿不到這顆 cookie。
  sessionCookieName: "tpass_auth_session",
  // v2：可申請 per-service token 的服務 id 白名單（逗號分隔，例 portal,form,msg,appeals）。
  // 每個服務拿到的 token aud=tpass:<id>，只在該服務有效——單一服務被攻破不再等於全生態淪陷。
  serviceIds: process.env.AUTH_SERVICE_IDS!.split(",").map((s) => s.trim()).filter(Boolean),
  // email → { serviceId: groups[] }。授權群組真相（見上方 parseGroups）。
  groups: parseGroups(process.env.AUTH_GROUPS),
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
    ttlSeconds: Number(process.env.JWT_TTL_SECONDS!),
    kid: KID,
  },
} as const;

export type AuthConfig = typeof authConfig;

// 查某人在某服務屬於哪些群組（發 per-service token 時用）。查無＝空陣列（非管理員）。
export function groupsFor(email: string, serviceId: string): string[] {
  return authConfig.groups[email.toLowerCase()]?.[serviceId] ?? [];
}
