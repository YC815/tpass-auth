// Arctic Google client（薄層 OAuth），login 與 callback 共用同一個設定來源。
import "server-only";
import { Google } from "arctic";
import { authConfig } from "@/config/auth";

export const google = new Google(
  authConfig.google.clientId,
  authConfig.google.clientSecret,
  authConfig.google.redirectUri,
);

// redirect_uri 白名單比對（安全關鍵，防 Open Redirect）。
// 必須是 host === base 或 host 以 '.'+base 結尾；
// 不可用裸 hostname.endsWith(base)，否則 evil-localhost / localhost.attacker.com 會通過。
export function isAllowedRedirect(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname;
  const base = authConfig.allowedHostSuffix;
  return host === base || host.endsWith("." + base);
}

// 暫存 OAuth 流程狀態的短效 cookie 名稱。
export const OAUTH_COOKIES = {
  state: "oauth_state",
  verifier: "oauth_verifier",
  redirect: "oauth_redirect",
} as const;
