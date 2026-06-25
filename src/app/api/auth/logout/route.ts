// POST /api/auth/logout — 清掉 session cookie 並回登入頁。
import { NextResponse } from "next/server";
import { authConfig } from "@/config/auth";

export const runtime = "nodejs";

export async function POST() {
  // 303 讓瀏覽器把 POST 轉成 GET 去取登入頁。
  const response = NextResponse.redirect(new URL("/", authConfig.baseUrl), 303);

  // 刪 cookie：name / domain / path 必須與當初設定時一致，否則刪不掉。
  response.cookies.set(authConfig.cookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: authConfig.cookie.secure,
    domain: authConfig.cookie.domain,
  });
  return response;
}
