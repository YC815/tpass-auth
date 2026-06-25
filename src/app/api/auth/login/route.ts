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
  // 登入成功後要導回哪裡；未指定則回本服務。
  const redirectUri =
    request.nextUrl.searchParams.get("redirect_uri") ?? authConfig.baseUrl;

  // 白名單驗證，防 Open Redirect。
  if (!isAllowedRedirect(redirectUri)) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authUrl = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_COOKIES.state, state, tempCookieOptions);
  response.cookies.set(OAUTH_COOKIES.verifier, codeVerifier, tempCookieOptions);
  response.cookies.set(OAUTH_COOKIES.redirect, redirectUri, tempCookieOptions);
  return response;
}
