// GET /api/auth/authorize?service=<id>&redirect_uri=<消費端 callback>&next=<站內路徑>
// 契約 v2 的核心：有 auth 登入態就簽一顆 aud=tpass:<id> 的 per-service token，
// 用自動送出的 form POST 交給消費端 callback（token 不進 URL / Referer / 瀏覽器歷史）；
// 沒有登入態就先走既有 Google OAuth，回來再繼續（redirect_uri 指回本 route）。
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/config/auth";
import { isAllowedRedirect } from "@/lib/oauth";
import { getSession, signServiceToken } from "@/lib/session";

export const runtime = "nodejs";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const serviceId = params.get("service") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const next = params.get("next") ?? "/";

  // 服務白名單：不認識的 service id 一律拒絕（env 驅動，新增服務只改 env）。
  if (!authConfig.serviceIds.includes(serviceId)) {
    return new NextResponse("Unknown service", { status: 400 });
  }
  // callback 位址必須在生態系根網域白名單內（同 login 的 Open Redirect 防線）。
  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }
  // next 只能是站內路徑（消費端 callback 會拿它做最後跳轉，不能被塞外部網址）。
  if (!next.startsWith("/") || next.startsWith("//")) {
    return new NextResponse("Invalid next", { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    // 沒登入 → 走既有 OAuth，完成後回到本 route 再發 token。
    const backHere = new URL("/api/auth/authorize", authConfig.baseUrl);
    backHere.searchParams.set("service", serviceId);
    backHere.searchParams.set("redirect_uri", redirectUri);
    backHere.searchParams.set("next", next);
    const login = new URL("/api/auth/login", authConfig.baseUrl);
    login.searchParams.set("redirect_uri", backHere.toString());
    return NextResponse.redirect(login);
  }

  // 重簽新 token（丟掉舊 exp，讓 per-service token 拿到完整 TTL）
  const token = await signServiceToken(
    {
      sub: session.sub,
      email: session.email,
      name: session.name,
      role: session.role,
      grade: session.grade,
    },
    serviceId,
  );

  // form_post：token 走 POST body，不落 URL。JS 自動送出；無 JS 給一顆按鈕。
  const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>T-Pass 轉導中…</title></head>
<body onload="document.forms[0].submit()">
<form method="post" action="${escapeHtml(redirectUri)}">
<input type="hidden" name="token" value="${escapeHtml(token)}">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<noscript><button type="submit">繼續前往服務</button></noscript>
</form>
</body></html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
