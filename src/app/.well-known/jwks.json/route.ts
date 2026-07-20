// GET /.well-known/jwks.json — 公開驗章公鑰。子網域 fetch 一次、本地驗 token。
import { NextResponse } from "next/server";
import { exportJWK } from "jose";
import { getPublicKeys } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const keys = await getPublicKeys();
  const body = {
    keys: await Promise.all(
      Array.from(keys.entries()).map(async ([kid, key]) => ({
        ...(await exportJWK(key)),
        alg: "EdDSA",
        use: "sig",
        // kid：平常只有一把；輪替期間會多一把舊鑰，子網域靠 kid 認得出是哪把。
        kid,
      })),
    ),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
