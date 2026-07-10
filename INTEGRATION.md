# T-Pass SSO 串接指南（權威合約・契約 v2）

> 這份文件是 **T-Pass 中央發證服務（auth）** 的對接合約，給兩種讀者：
>
> 1. **人類工程師** — 想把自己的校園服務接上「一次登入、全生態系通行」。
> 2. **AI coding agent（例如 Claude Code）** — 要直接照這份文件幫某個服務寫出串接程式碼。
>    → 如果你是 agent，先讀最後的 [§12 給 AI agent 的實作指令](#12-給-ai-agent-的實作指令)。
>
> auth 的職責：**跑 Google OAuth 確認身分**、**對每個服務簽發只在該服務有效的 EdDSA JWT**、
> **公開 JWKS 公鑰**。你的服務 **不需要、也拿不到任何密鑰**；你只用公鑰在自己後端本地驗章。
>
> ⚠️ **v1（跨子網域共用 cookie）已棄用**，遷移期間仍相容，見 [附錄 A](#附錄-av1-合約已棄用遷移期相容)。

---

## 0. 一分鐘心智模型

```
┌──────────────┐ 1. 未登入 → 導去 auth /authorize   ┌──────────────────────────┐
│   你的服務    │ ─────────────────────────────────▶ │   auth.lvh.me（本服務）    │
│  foo.lvh.me  │                                    │ - 沒登入態→先跑Google OAuth │
│              │ ◀───────────────────────────────── │ - 簽 aud=tpass:foo 的 JWT  │
└──────────────┘ 2. form POST token 到你的 callback  └──────────────────────────┘
       │ 3. 你的 callback 用 JWKS 公鑰「本地驗章」，             │
       │    驗過才寫進「你自己的」host-only cookie               │（啟動時抓一次即可）
       └────────────── 4. 之後每個請求讀自己的 cookie ◀─ JWKS 公鑰 ─┘
                         本地驗章認出使用者（全程不回呼 auth）
```

關鍵設計：

- **非對稱簽章**：auth 用私鑰簽、你用公鑰驗。私鑰永遠不出 auth；驗章在你自己後端做，
  **不需要每次請求都打 auth** → auth 當機也不影響「已登入者」被你認出。
- **per-service token（v2 核心）**：每個服務拿到的 token `aud=tpass:<你的服務id>`，
  **只在你的服務驗得過**。就算某個服務被攻破、或某個子網域被接管，攻擊者拿到的 token
  在其他服務一律無效——爆炸半徑只有單一服務。
- **host-only cookie**：token 存在**你自己網域**的 cookie（不設 `Domain`），
  別的子網域根本收不到，瀏覽器不會把你的通行證送去任何其他服務。

---

## 1. 環境與網域（本測試階段的具體值）

| 角色 | 網址（本機測試階段） | 說明 |
| --- | --- | --- |
| 中央發證 auth | `https://auth.lvh.me:3000` | 本服務 |
| 範例消費端 portal | `https://portal.lvh.me:3001` | 門戶（同時是參考實作） |
| 你的服務 | `https://<你的子網域>.lvh.me:<port>` | 必須在 `*.lvh.me` 底下 |

> **為什麼是 `lvh.me`？** `lvh.me` 及其所有子網域由公共 DNS 直接解析到 `127.0.0.1`，
> 且 `.me` 是 Google OAuth 接受的公共 TLD。本機開發**不需要改 `/etc/hosts`**。
> **上線後**換正式網域（`*.tschoolsu.org`）。**所有網址都是 env 驅動的**（見 §10），不要寫死。

---

## 2. 契約速查（先看這張表）

| 項目 | 值 |
| --- | --- |
| **你的服務 id** | 向 auth 管理者登記（＝ tpass-ops `services.json` 的 id，例 `form`）；auth 端進 `AUTH_SERVICE_IDS` 白名單 |
| **授權入口** | `GET https://auth.lvh.me:3000/api/auth/authorize?service=<id>&redirect_uri=<你的 callback 完整網址>&next=<站內路徑>` |
| **token 交付方式** | auth 以自動送出的 `<form method="post">` 把 `token` + `next` POST 到你的 callback（token 不進 URL / Referer / 歷史） |
| **你要提供的 callback** | `POST <你的服務>/api/auth/callback`（收 `token`+`next`，驗章後寫自己的 cookie，303 到 `next`） |
| **你自己的 cookie** | 名稱建議 `tpass_token`；**host-only（不設 Domain）**、`HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/`、`Max-Age` ≤ token 剩餘壽命 |
| **簽章演算法** | `EdDSA`（Ed25519）— 驗章時**必須鎖死** |
| **JWT header** | `{ "alg": "EdDSA", "kid": "tpass-key-1", "typ": "JWT" }` |
| **issuer（`iss`）** | `https://auth.lvh.me:3000` — 驗章時**必須檢查** |
| **audience（`aud`）** | `tpass:<你的服務id>`（例 `tpass:form`）— 驗章時**必須檢查**，不是 v1 的 `tschool-sso` |
| **JWKS 公鑰來源** | `GET https://auth.lvh.me:3000/.well-known/jwks.json` |
| **登出** | 你自己的 `POST /api/auth/logout`：清自己的 cookie → form POST 到 auth `POST /api/auth/logout?redirect_uri=<你的完整網址>`（清 auth 登入態） |
| **token 有效期** | 8 小時（`exp - iat`） |

---

## 3. JWT Payload 欄位定義

你的 callback 收到的 `token` 是一個 JWT，其 payload：

```json
{
  "sub": "104857600293847561029",
  "email": "b11302042@tschool.tp.edu.tw",
  "name": "林大明",
  "role": "student",
  "grade": null,
  "iss": "https://auth.lvh.me:3000",
  "aud": "tpass:form",
  "iat": 1750000000,
  "exp": 1750028800
}
```

| 欄位 | 型別 | 必有 | 意義 |
| --- | --- | --- | --- |
| `sub` | `string` | ✓ | 使用者唯一識別碼（來自 Google 的 `sub`，跨服務一致、可當主鍵） |
| `email` | `string` | ✓ | 學校信箱，已通過 `email_verified` 與網域白名單 |
| `name` | `string` | ✓ | 顯示名稱 |
| `role` | `string` | ✓ | 角色。目前 auth 尚未接學籍目錄，**一律先給 `"student"`**；未來會有 `"teacher"` 等 |
| `grade` | `string \| null` | ✓ | 年級。目前**一律 `null`**（待接學籍目錄）。注意型別是 `string` 不是 `number` |
| `iss` | `string` | ✓ | 簽發者，必為 §2 的 issuer |
| `aud` | `string` | ✓ | 受眾，必為 `tpass:<你的服務id>` |
| `iat` / `exp` | `number` | ✓ | 簽發 / 到期時間（Unix 秒） |

> ⚠️ `role` / `grade` 目前是 placeholder。**你的程式要能容忍 `grade` 為 `null`、`role` 恆為
> `student`**，權限判斷請用自己服務內的 allowlist（參考各服務 `config/admin.ts` 模式），
> **不要拿 `role` 當權限依據**。

---

## 4. JWKS 公鑰格式

```
GET https://auth.lvh.me:3000/.well-known/jwks.json
Cache-Control: public, max-age=3600
```

```json
{
  "keys": [
    { "kty": "OKP", "crv": "Ed25519", "alg": "EdDSA", "use": "sig",
      "kid": "tpass-key-1", "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }
  ]
}
```

- `kid` 用於**金鑰輪替**：請用會「依 `kid` 自動選鑰」的函式庫（`jose` 的
  `createRemoteJWKSet`、PyJWT 的 `PyJWKClient`），不要自己抓第一把硬用。
- 這裡**只有公鑰**（`x`），沒有私鑰（`d`）。這是刻意的。
- 可以快取（`max-age=3600`）；`createRemoteJWKSet` 會自動快取 + 遇到未知 `kid` 時重抓（含冷卻）。

### 4.1 發證端（issuer）金鑰輪替 runbook

消費端用 `createRemoteJWKSet` 已經是「依 `kid` 自動選鑰」，遇到未知 `kid` 會自動重抓
JWKS——**輪替時消費端不用改任何程式碼**。以下是 auth 這邊（issuer）實際換鑰的步驟。

**例行輪替（有 overlap，不會把人踢下線）：**

1. `node scripts/gen-keys.mjs` 產生一組新的 EdDSA 金鑰對。
2. 把現有的 `JWT_PUBLIC_KEY` / `JWT_KID`（舊鑰）搬去 `JWT_PREV_PUBLIC_KEY` / `JWT_PREV_KID`。
3. 把新產生的私鑰、公鑰、kid 填進 `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` / `JWT_KID`。
4. 重啟 auth。此刻 JWKS 同時公開新舊兩把公鑰，新簽的 token 用新 kid，
   舊 kid 簽出去、還沒過期的 token 仍驗得過（overlap）。
5. 等待 ≥ token TTL（預設 8 小時），確保所有帶舊 kid 的 token 都已自然過期。
6. 清空 `JWT_PREV_PUBLIC_KEY` / `JWT_PREV_KID`，重啟 auth。輪替完成，舊鑰徹底下線。

**緊急輪替（私鑰疑似外洩）：**

1. 立刻產生新金鑰對，換上新的 `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` / `JWT_KID`、重啟。
2. **不要**把外洩的舊鑰放進 `JWT_PREV_PUBLIC_KEY`——那等於繼續讓攻擊者偽造的 token 驗得過，
   overlap 機制在這裡不適用。
3. 注意傳播窗口：新簽的 token 帶新 kid，消費端遇到未知 kid 會立刻重抓 JWKS，這段很快；
   但消費端**快取住的舊 JWKS**（還記得外洩那個 kid）在快取過期（`max-age=3600`，最長
   約 1 小時）前，仍可能誤信用外洩私鑰偽造、帶舊 kid 的 token。若要縮短這個窗口，
   可臨時調低 `/.well-known/jwks.json` 的 `max-age`（見本檔案第 4 節、`route.ts`）。

---

## 5. 驗章規則（安全關鍵，逐條必做）

驗一個 token 時，**一定**要同時滿足這四條，缺一不可：

1. **鎖演算法 `algorithms: ['EdDSA']`。**
   <br>❗ **不鎖 = 可被偽造任意身分**（algorithm confusion：攻擊者把 header `alg` 改成 `HS256`，
   拿你公開的 JWKS 公鑰位元組當 HMAC 密鑰簽假 token；沒鎖的函式庫會「用公鑰當對稱密鑰」驗過）。
2. **檢查 `issuer` == `https://auth.lvh.me:3000`。** 票是「這個 auth」簽的。
3. **檢查 `audience` == `tpass:<你的服務id>`。** 票是簽給**你**的——別的服務的 token、
   v1 的共用 token，在你這裡都必須驗不過。這就是 v2 的爆炸半徑隔離。
4. **檢查 `exp` 沒過期。**（主流函式庫預設就會檢查，但確認沒被關掉。）

驗不過 → **一律當成「未登入」**，導去授權入口；**不要把例外訊息丟給前端**。

---

## 6. ⚠️ 最重要的限制：純前端 SPA 接不了，必須有後端

token 只該存在 **`HttpOnly`** cookie（防 XSS 竊 token），且 callback 要驗章——都是後端的活。

- ✅ 可以做的地方：Server Component / Route Handler / Middleware / Express / 任何 server。
- ❌ 不行的地方：瀏覽器 JS（`document.cookie` 讀不到 HttpOnly cookie）。

**純前端 SPA 必須自備一層薄後端**（`/api/auth/callback`、`/api/me` 之類），
前端跟「自己的後端」要身分，不是跟 auth 要。**絕不把 token 放 `localStorage`。**

---

## 7. 登入 / 登出流程

### 7.1 登入（authorize → form_post → callback）

你的後端判定「沒有有效 session」時，把使用者導去授權入口。三個參數都必填：

```
https://auth.lvh.me:3000/api/auth/authorize
  ?service=foo                                            ← 你登記的服務 id
  &redirect_uri=https://foo.lvh.me:3002/api/auth/callback  ← 你的 callback 完整網址
  &next=/dashboard                                         ← 完成後回到你站內哪個路徑
```

整個流程：

```
你的服務（未登入，想去 /dashboard）
  → 302 導去 auth /api/auth/authorize?service=foo&redirect_uri=...&next=/dashboard
    → auth 有登入態？
        沒有 → 307 去 accounts.google.com 跑 OAuth → 回 auth → 寫 auth 自己的
               host-only session cookie → 302 回到 authorize（同參數）
        有   → 簽 aud=tpass:foo 的 token
    → auth 回一頁自動送出的 <form method="post" action="你的 callback">
      （hidden 欄位：token、next；token 全程不出現在 URL）
  → 你的 POST /api/auth/callback：
      1. 驗章（§5 四鐵則，aud=tpass:foo）
      2. 驗過 → Set-Cookie: tpass_token=<token>（host-only、HttpOnly、Secure、Lax）
      3. 檢查 next 是站內路徑（以 / 開頭、非 //）→ 303 導去 next ✅
```

**authorize 可能的錯誤**（都是你串接時要修的設定問題，不是使用者錯）：
- `400 Unknown service` — `service` 不在 auth 的 `AUTH_SERVICE_IDS` 白名單，先找 auth 管理者登記。
- `400 Invalid redirect_uri` — callback 網址不是完整網址、或 hostname 不在 `*.lvh.me`（防 Open Redirect）。
- `400 Invalid next` — `next` 必須是站內路徑（`/` 開頭且非 `//` 開頭）。

**登入失敗**（auth 會導回它自己的首頁並帶 query）：`/?error=domain`（email 不在允許網域）、
`/?error=oauth`（跟 Google 換 token 失敗）。

### 7.2 登出（兩段式：清自己 + 清 auth）

v2 的登出是**你自己的 route**（因為你自己的 cookie 只有你能清）：

```
你的頁面 <form method="post" action="/api/auth/logout">登出</form>
  → 你的 POST /api/auth/logout：
      1. 清自己的 tpass_token cookie
      2. 回一頁自動送出的 form POST 到
         https://auth.lvh.me:3000/api/auth/logout?redirect_uri=https://foo.lvh.me:3002
  → auth 清掉自己的登入態（與遷移期的 v1 共用 cookie）
  → 303 導回你的服務（帶 ?logout=1，純畫面提示，不是身分憑證）
```

其他服務的 per-service cookie 會留到各自 `exp` 過期（≤8h）——這是 v2 用「隔離」換來的已知
取捨：登出不再是全生態即時，而是「auth 不再發新票 + 舊票自然過期」。

---

## 8. 參考實作（可直接抄）

> 標準參考實作在 **`portal` 服務**：`../tpass-portal/src/lib/tpass-auth.ts`（驗章核心）、
> `../tpass-portal/src/config/portal.ts`（設定）、`../tpass-portal/src/app/api/auth/callback/route.ts`
> （token 接收）、`../tpass-portal/src/app/api/auth/logout/route.ts`（登出鏈）。**照抄這四個檔**，
> 只把 `portal` 換成你的服務 id。

### 8.1 Node / TypeScript（`jose`）— 驗章核心

```ts
// lib/tpass-auth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = process.env.JWT_ISSUER!;                  // https://auth.lvh.me:3000
const AUDIENCE = `tpass:${process.env.TPASS_SERVICE_ID!}`; // tpass:foo
const JWKS = createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL!));

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA"],  // ★ 1. 鎖演算法
      issuer: ISSUER,          // ★ 2. 檢查 iss
      audience: AUDIENCE,      // ★ 3. 檢查 aud（exp 由 jose 自動檢查 = 4）
    });
    return payload; // { sub, email, name, role, grade, ... }
  } catch {
    return null;    // 過期 / 竄改 / 錯 iss/aud / 錯 alg → 一律視為未登入
  }
}
```

### 8.2 Next.js — callback route（收 token、寫自己的 cookie）

```ts
// app/api/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/tpass-auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = form.get("token");
  const next = String(form.get("next") ?? "/");
  if (typeof token !== "string") return new NextResponse("Bad request", { status: 400 });

  const claims = await verifyToken(token);            // §5 四鐵則
  if (!claims) return new NextResponse("Invalid token", { status: 401 });

  // next 只能是站內路徑（防 Open Redirect）
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, process.env.FOO_SELF_URL!), 303);
  res.cookies.set("tpass_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: Math.max(0, (claims.exp as number) - Math.floor(Date.now() / 1000)),
    // 注意：不設 domain → host-only，這就是隔離的來源
  });
  return res;
}
```

### 8.3 讀 session（每個請求）

```ts
// 續 lib/tpass-auth.ts
import { cookies } from "next/headers";

export async function getSession() {
  const token = (await cookies()).get("tpass_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
```

### 8.4 Next.js — 登出 route（兩段式）

```ts
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const authLogout = `${process.env.AUTH_LOGOUT_URL}?redirect_uri=${encodeURIComponent(process.env.FOO_SELF_URL!)}`;
  const html = `<!doctype html><meta charset="utf-8"><body onload="document.forms[0].submit()">
<form method="post" action="${authLogout}"><noscript><button>完成登出</button></noscript></form>`;
  const res = new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
  res.cookies.set("tpass_token", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return res;
}
```

### 8.5 其他語言（通用演算法）

```
登入： 沒 session → 302 去 auth /api/auth/authorize?service=<id>&redirect_uri=<callback>&next=<path>
callback（POST，form-encoded token+next）：
  1. 用 JWKS 公鑰驗 token：鎖 EdDSA、iss、aud=tpass:<id>、exp（四者不可省）
  2. 驗過 → Set-Cookie（host-only、HttpOnly、Secure、Lax、Max-Age≤剩餘壽命）
  3. 303 → next（必須站內路徑）
每請求： 讀自己 cookie → 同樣四鐵則驗章 → 認出使用者
登出：   清自己 cookie → form POST auth /api/auth/logout?redirect_uri=<self>
```

（Python 用 `pyjwt[crypto]` + `PyJWKClient`；Go 用 `lestrrat-go/jwx`；Java 用 `nimbus-jose-jwt`。）

---

## 9. 本機開發環境注意事項（最容易踩雷）

1. **信任 mkcert 根憑證**：`mkcert -install` 一次（tpass-ops 的 `tpass setup` 會處理）。
2. **★ 後端 fetch JWKS 時要讓 runtime 信任 mkcert CA**：Node 不讀 OS 信任區，
   啟動帶 `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`；
   Next dev（Turbopack/undici）連這個都不吃，`tpass dev` 已對消費端自動處理。
   上線換公開 CA 後不需要。
3. **`lvh.me` 免改 `/etc/hosts`**。
4. **Next.js 沒有原生 HTTPS**：production smoke 用 `server.mjs`（可抄本 repo 的）。

---

## 10. 設定都是 env 驅動（不要寫死網址）

| 你需要的 env | 本階段值 | 上線會變 |
| --- | --- | --- |
| `TPASS_SERVICE_ID` | 你登記的服務 id（例 `foo`） | 不變 |
| `JWT_ISSUER` | `https://auth.lvh.me:3000` | ✓ 換正式網域 |
| `AUTH_JWKS_URL` | `<issuer>/.well-known/jwks.json` | 隨 issuer 變 |
| `AUTH_AUTHORIZE_URL` | `<issuer>/api/auth/authorize` | 隨 issuer 變 |
| `AUTH_LOGOUT_URL` | `<issuer>/api/auth/logout` | 隨 issuer 變 |
| `<SVC>_SELF_URL` | `https://foo.lvh.me:3002` | ✓ 換正式網域 |
| （遷移期）`JWT_AUDIENCE`、`TPASS_COOKIE_NAME` | `tschool-sso`、`tpass_session` | v1 停用後移除 |

---

## 11. 疑難排解（FAQ）

| 症狀 | 可能原因 / 解法 |
| --- | --- |
| 後端 fetch JWKS 報 TLS 錯 | 沒設 `NODE_EXTRA_CA_CERTS`（§9.2），或用 `tpass dev` 啟動 |
| authorize 回 `400 Unknown service` | 服務 id 沒進 auth 的 `AUTH_SERVICE_IDS`，找管理者登記後重啟 auth |
| authorize 回 `400 Invalid redirect_uri` | callback 不是完整網址、或 hostname 不在根網域白名單 |
| callback 收到 token 但驗不過 | aud 對不上——你驗的是 `tpass:<id>`？id 與 authorize 的 `service` 一致？ |
| 登入後又立刻被導回登入 | ①cookie 沒寫成功（Secure 但你走 http？）②每請求驗章用錯 aud ③cookie 名不一致 |
| 一直 `/?error=domain` | 登入的 Google 帳號不在允許網域 |
| 驗章一直失敗但 token 看起來正常 | 沒鎖 `algorithms:['EdDSA']`、或 iss/aud 字串不一致（port、結尾斜線） |
| token 過幾小時失效 | 正常，TTL 8 小時 |
| 純前端拿不到 cookie | 正常（HttpOnly），需要薄後端（§6） |

---

## 12. 給 AI agent 的實作指令

**前置確認：**
1. 服務**有沒有後端**？純前端 SPA → 停下來告訴使用者要先加薄後端（§6）。
2. 服務網域在 `*.lvh.me`（本機）/ 正式根網域底下、走 HTTPS？
3. 服務 id 已登記進 auth 的 `AUTH_SERVICE_IDS` 與 tpass-ops `services.json`？沒有→先登記。

**實作步驟：**
1. `npm install jose`（或該語言 JOSE 函式庫）。
2. 設定模組集中放 env（§10 那七個），全部從 env 讀。
3. 驗章模組：`createRemoteJWKSet` + `jwtVerify` 鎖 `algorithms:['EdDSA']` + `issuer` +
   `audience: 'tpass:<id>'`，失敗回 null（§5 四鐵則）。
4. `POST /api/auth/callback`：驗 token → 寫 host-only `HttpOnly` cookie → 303 到站內 `next`（§8.2）。
5. 每請求在 server 端讀自己的 cookie → 驗章（§8.3）。
6. 未登入 → 302 去 authorize（§7.1 三參數）。
7. `POST /api/auth/logout`：清自己 cookie → form POST auth logout（§8.4）。
8. 本機啟動用 tpass-ops 的 `tpass dev <id>`（自動處理 mkcert / TLS 信任）。

**完工前自我驗收（不需 Google 也能測）：**
- [ ] `algorithms` 確實鎖成 `['EdDSA']`（grep 確認）。
- [ ] issuer、audience 都檢查，audience 是 `tpass:<id>` 不是 `tschool-sso`。
- [ ] cookie host-only（**沒有** `domain` 屬性）、HttpOnly、Secure、Lax。
- [ ] callback 對「過期 / 竄改 / 錯 aud / HS256+公鑰簽」四種假 token 都回 401。
- [ ] callback 的 `next` 擋掉 `https://evil.com`、`//evil.com`（只允許站內路徑）。
- [ ] 前端 JS 沒有讀 token、`localStorage` 沒有 token。

**絕對不要做：**
- ❌ 不要自動化 Google 登入（會被擋、違反條款）。要真人登入時停下來請使用者操作。
- ❌ 不要 import / 複製 auth 的私鑰、`arctic`、OAuth callback。消費端**只需要公鑰**。
- ❌ 不要在前端驗章、不要把 token 塞 `localStorage`、不要關 `algorithms` 鎖定、
     不要把 cookie 設成 `Domain=.<根網域>`（那是 v1，正在退場）。

---

## 附錄 A：v1 合約（已棄用，遷移期相容）

v1 = auth 簽單一 `aud=tschool-sso` 的 JWT，寫進 `Domain=.<根網域>` 的共用 cookie
`tpass_session`，所有子網域共享。**缺陷：任何一個子網域被攻破或接管，等於全生態帳號淪陷。**

遷移期行為（`AUTH_ISSUE_LEGACY_COOKIE=1`，預設）：
- auth 登入後**同時**簽 v1 共用 cookie 與 v2 host-only session。
- 未升級的消費端照舊讀 `tpass_session`（aud `tschool-sso`）驗章，行為不變。
- 已升級的消費端先讀自己的 `tpass_token`，沒有才 fallback 讀 v1 共用 cookie
  （讓既有登入者不被強制重登）。

退場步驟（全部消費端升到 v2 後）：
1. auth 設 `AUTH_ISSUE_LEGACY_COOKIE=0` 停發共用 cookie。
2. 消費端移除 fallback 與 `JWT_AUDIENCE` / `TPASS_COOKIE_NAME` env。
3. 舊 cookie 於 8 小時內自然過期，遷移完成。
