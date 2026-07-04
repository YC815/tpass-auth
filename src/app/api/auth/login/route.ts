// GET /api/auth/login — 啟動 Google OAuth 流程。
import { NextResponse, type NextRequest } from "next/server";
import { generateState, generateCodeVerifier } from "arctic";
import { authConfig } from "@/config/auth";
import { google, isAllowedRedirect, OAUTH_COOKIES } from "@/lib/oauth";

export const runtime = "nodejs";

// 短效暫存 cookie：HttpOnly + SameSite=Lax + 10 分鐘。
// 必 Lax 不可 Strict——Strict 時從 Google 跳回瀏覽器不會帶這些 cookie，登入會壞。
const tempCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
  secure: authConfig.cookie.secure,
};

export async function GET(request: NextRequest) {
  // 登入成功後要導回哪裡。外部傳入的值要過白名單（防 Open Redirect）；
  // 沒帶（被單獨訪問）就用信任的預設值＝門戶大廳，不必也不該被 suffix 白名單擋。
  const requested = request.nextUrl.searchParams.get("redirect_uri");
  if (requested && !isAllowedRedirect(requested)) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }
  const redirectUri = requested ?? authConfig.portalUrl;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authUrl = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);
  // 讓 Google 帳號選擇器只顯示本網域帳號（UX 過濾）。真正的安全閘門仍是
  // callback 端的 email 網域驗證——hd 只是提示，不可當作唯一防線。
  authUrl.searchParams.set("hd", authConfig.allowedEmailDomain);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_COOKIES.state, state, tempCookieOptions);
  response.cookies.set(OAUTH_COOKIES.verifier, codeVerifier, tempCookieOptions);
  response.cookies.set(OAUTH_COOKIES.redirect, redirectUri, tempCookieOptions);
  return response;
}
