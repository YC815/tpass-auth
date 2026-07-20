// 所有 token 邏輯集中於此：簽 / 驗 / 讀 session、把 Google profile 映射成 claims。
import "server-only";
import { cookies } from "next/headers";
import {
  SignJWT,
  jwtVerify,
  importPKCS8,
  importSPKI,
  type CryptoKey,
} from "jose";
import { authConfig } from "@/config/auth";

// T-Pass 對接合約：簽進 JWT 的身分內容。
export interface TPassClaims {
  sub: string;
  email: string;
  name: string;
  role: string;
  grade: string | null;
  exp: number;
}

// Google userinfo endpoint 回傳的（我們用到的）欄位。
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  email_verified?: boolean;
}

// PEM → CryptoKey 是 async，不能在 module top-level 同步做。
// 用 module 級 cached promise 各載入一次。
let privateKeyPromise: Promise<CryptoKey> | null = null;
let publicKeysPromise: Promise<Map<string, CryptoKey>> | null = null;

function getPrivateKey(): Promise<CryptoKey> {
  privateKeyPromise ??= importPKCS8(authConfig.jwt.privateKeyPem, "EdDSA");
  return privateKeyPromise;
}

// 依 kid 索引的公鑰表：平常只有一把（目前簽章用的），輪替期間會多一把舊鑰供驗章。
async function loadPublicKeys(): Promise<Map<string, CryptoKey>> {
  const entries = await Promise.all(
    authConfig.jwt.publicKeys.map(
      async ({ kid, pem }) => [kid, await importSPKI(pem, "EdDSA")] as const,
    ),
  );
  return new Map(entries);
}

function getPublicKeys(): Promise<Map<string, CryptoKey>> {
  publicKeysPromise ??= loadPublicKeys();
  return publicKeysPromise;
}

// 公鑰表也給 JWKS route 用。
export { getPublicKeys };

// audience 命名慣例（契約 v2）：每個服務一個 aud=tpass:<serviceId>，token 只在該服務有效。
export const serviceAudience = (serviceId: string) => `tpass:${serviceId}`;

// auth 自己登入態的 audience（host-only cookie 裡那顆）。
const AUTH_SELF_AUDIENCE = serviceAudience("auth");

// 以指定 audience 簽 JWT（共用簽章邏輯；aud 決定這顆 token 在哪裡有效）。
async function sign(
  claims: Omit<TPassClaims, "exp">,
  audience: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await getPrivateKey();
  return new SignJWT({
    email: claims.email,
    name: claims.name,
    role: claims.role,
    grade: claims.grade,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: authConfig.jwt.signingKid })
    .setSubject(claims.sub)
    .setIssuer(authConfig.jwt.issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + authConfig.jwt.ttlSeconds)
    .sign(privateKey);
}

// v2：簽 auth 自己的登入態（host-only cookie 用）。
export const signAuthSession = (claims: Omit<TPassClaims, "exp">) =>
  sign(claims, AUTH_SELF_AUDIENCE);

// v2：簽 per-service token。aud=tpass:<id>，只在該服務有效——
// 單一服務被攻破或子網域被接管，拿到的 token 在其他服務一律驗不過。
export const signServiceToken = (
  claims: Omit<TPassClaims, "exp">,
  serviceId: string,
) => sign(claims, serviceAudience(serviceId));

// 用公鑰驗章。安全關鍵：必鎖 algorithms 防 alg confusion（公鑰被當對稱密鑰偽造 token）。
// 失敗一律回 null，不把 error throw 給呼叫端。
// audience 必填：驗哪一張票由呼叫端明講，不給預設值——預設值只會讓人忘記傳而驗錯對象。
export async function verifySession(
  token: string,
  audience: string,
): Promise<TPassClaims | null> {
  try {
    const keys = await getPublicKeys();
    const { payload } = await jwtVerify(
      token,
      async (header) => {
        const k = header.kid ? keys.get(header.kid) : undefined;
        if (!k) throw new Error("unknown kid");
        return k;
      },
      {
        algorithms: ["EdDSA"],
        issuer: authConfig.jwt.issuer,
        audience,
      },
    );
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      grade: (payload.grade as string | null) ?? null,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

// 讀 auth 目前的登入態：v2 host-only cookie，沒有就是沒登入。
export async function getSession(): Promise<TPassClaims | null> {
  const jar = await cookies();
  const own = jar.get(authConfig.sessionCookieName)?.value;
  if (!own) return null;
  return verifySession(own, AUTH_SELF_AUDIENCE);
}

// 把 Google profile 映射成 T-Pass claims。
// role / grade Google 不會給，dev 階段先用簡單預設。
export function resolveClaims(profile: GoogleProfile): Omit<TPassClaims, "exp"> {
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    // TODO: 接真實 user directory 取得 role / grade
    role: "student",
    grade: null,
  };
}
