// POST /api/auth/logout — 清掉 session cookie，導回原服務（或回登入頁）。
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/config/auth";
import { isAllowedRedirect } from "@/lib/oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // redirect_uri 選填：帶了就導回原服務（過白名單，防 Open Redirect），
  // 不帶就維持舊行為導回 auth 首頁——舊服務不升級也不受影響。
  const requested = request.nextUrl.searchParams.get("redirect_uri");
  if (requested && !isAllowedRedirect(requested)) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }

  let target: URL;
  if (requested) {
    target = new URL(requested);
    // 純畫面提示，不是身分憑證：消費端只能在 session 已確認無效時才拿它決定文案。
    target.searchParams.set("logout", "1");
  } else {
    target = new URL("/", authConfig.baseUrl);
  }

  // 303 讓瀏覽器把 POST 轉成 GET 去取目標頁。
  const response = NextResponse.redirect(target, 303);

  // 刪 cookie：name / path 必須與當初設定時一致，否則刪不掉。
  // 這裡只清 auth 自己的 v2 host-only session；消費端自己的 per-service cookie
  // 由各消費端的 /api/auth/logout 清（見 INTEGRATION.md §登出）。
  response.cookies.set(authConfig.sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: authConfig.cookieSecure,
  });
  return response;
}
