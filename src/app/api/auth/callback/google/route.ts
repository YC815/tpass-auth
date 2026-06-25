// GET /api/auth/callback/google — Google 授權後跳回，換 token、發 T-Pass 通行證。
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/config/auth";
import { google, isAllowedRedirect, OAUTH_COOKIES } from "@/lib/oauth";
import { resolveClaims, signSession, type GoogleProfile } from "@/lib/session";

export const runtime = "nodejs";

const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

// 登入失敗時導回登入頁並帶錯誤碼。
function fail(reason: string) {
  return NextResponse.redirect(
    new URL(`/?error=${reason}`, authConfig.baseUrl),
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  const cookieState = request.cookies.get(OAUTH_COOKIES.state)?.value;
  const codeVerifier = request.cookies.get(OAUTH_COOKIES.verifier)?.value;
  const storedRedirect = request.cookies.get(OAUTH_COOKIES.redirect)?.value;

  // CSRF 防護：cookie 裡的 state 必須與回傳的 state 相符。
  if (!code || !state || !cookieState || state !== cookieState || !codeVerifier) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  // redirect_uri 在 login 時已驗過，這裡再驗一次（cookie 可能被竄改），不合法則回本服務。
  const redirectTarget =
    storedRedirect && isAllowedRedirect(storedRedirect)
      ? storedRedirect
      : authConfig.baseUrl;

  // 用 codeVerifier 換 token。
  let accessToken: string;
  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    accessToken = tokens.accessToken();
  } catch {
    return fail("oauth");
  }

  // 取使用者資料：打 userinfo endpoint（不手動解 id_token）。
  let profile: GoogleProfile;
  try {
    const res = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return fail("oauth");
    profile = (await res.json()) as GoogleProfile;
  } catch {
    return fail("oauth");
  }

  // Email 網域過濾（安全關鍵）：必須是已驗證信箱，且網域相符。
  // 用 '@'+domain 比對，避免 evilchen.zone 這種後綴繞過。
  const email = profile.email?.toLowerCase() ?? "";
  if (
    !profile.email_verified ||
    !email.endsWith("@" + authConfig.allowedEmailDomain)
  ) {
    return fail("domain");
  }

  // 簽發 T-Pass session JWT。
  const token = await signSession(resolveClaims(profile));

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.set(authConfig.cookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: authConfig.jwt.ttlSeconds,
    secure: authConfig.cookie.secure,
    domain: authConfig.cookie.domain,
  });

  // 清掉暫存 cookie。
  response.cookies.delete(OAUTH_COOKIES.state);
  response.cookies.delete(OAUTH_COOKIES.verifier);
  response.cookies.delete(OAUTH_COOKIES.redirect);
  return response;
}
