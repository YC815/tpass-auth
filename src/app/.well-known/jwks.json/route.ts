// GET /.well-known/jwks.json — 公開驗章公鑰。子網域 fetch 一次、本地驗 token。
import { NextResponse } from "next/server";
import { exportJWK } from "jose";
import { authConfig } from "@/config/auth";
import { getPublicKey } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const jwk = await exportJWK(await getPublicKey());
  const body = {
    keys: [
      {
        ...jwk,
        alg: "EdDSA",
        use: "sig",
        // kid：即使現在只有一把鑰，未來輪替時子網域才認得出是哪把。
        kid: authConfig.jwt.kid,
      },
    ],
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
