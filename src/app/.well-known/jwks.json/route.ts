// GET /.well-known/jwks.json — 公開驗章公鑰。子網域 fetch 一次、本地驗 token。
// 平常只有一把；金鑰輪替期間會有兩把（新舊各一），消費端依 token header 的 kid 選鑰。
import { NextResponse } from "next/server";
import { exportJWK } from "jose";
import { getPublicKeys } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const keys = await getPublicKeys();
  const body = {
    keys: await Promise.all(
      [...keys].map(async ([kid, key]) => ({
        ...(await exportJWK(key)),
        alg: "EdDSA",
        use: "sig",
        kid,
      })),
    ),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
