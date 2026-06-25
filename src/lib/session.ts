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
let publicKeyPromise: Promise<CryptoKey> | null = null;

function getPrivateKey(): Promise<CryptoKey> {
  privateKeyPromise ??= importPKCS8(authConfig.jwt.privateKeyPem, "EdDSA");
  return privateKeyPromise;
}

function getPublicKey(): Promise<CryptoKey> {
  publicKeyPromise ??= importSPKI(authConfig.jwt.publicKeyPem, "EdDSA");
  return publicKeyPromise;
}

// 公鑰也給 JWKS route 用。
export { getPublicKey };

// 用 EdDSA 私鑰簽發 session JWT。
export async function signSession(
  claims: Omit<TPassClaims, "exp">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await getPrivateKey();
  return new SignJWT({
    email: claims.email,
    name: claims.name,
    role: claims.role,
    grade: claims.grade,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: authConfig.jwt.kid })
    .setSubject(claims.sub)
    .setIssuer(authConfig.jwt.issuer)
    .setAudience(authConfig.jwt.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + authConfig.jwt.ttlSeconds)
    .sign(privateKey);
}

// 用公鑰驗章。安全關鍵：必鎖 algorithms 防 alg confusion（公鑰被當對稱密鑰偽造 token）。
// 失敗一律回 null，不把 error throw 給呼叫端。
export async function verifySession(
  token: string,
): Promise<TPassClaims | null> {
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ["EdDSA"],
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
    });
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

// 從 cookie 讀目前 session，回 claims 或 null。
export async function getSession(): Promise<TPassClaims | null> {
  const token = (await cookies()).get(authConfig.cookie.name)?.value;
  if (!token) return null;
  return verifySession(token);
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
