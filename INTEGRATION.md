# T-Pass SSO 串接指南（權威合約）

> 這份文件是 **T-Pass 中央發證服務（auth）** 的對接合約，給兩種讀者：
>
> 1. **人類工程師** — 想把自己的校園服務接上「一次登入、全生態系通行」。
> 2. **AI coding agent（例如 Claude Code）** — 要直接照這份文件幫某個服務寫出串接程式碼。
>    → 如果你是 agent，先讀最後的 [§12 給 AI agent 的實作指令](#12-給-ai-agent-的實作指令)，那裡有可直接執行的步驟與驗收清單。
>
> 本服務的職責只有兩件事：**跑 Google OAuth 把身分簽成 JWT 寫進頂層 cookie**、**公開 JWKS 公鑰**。
> 你的服務 **不需要、也拿不到任何密鑰**；你只用公鑰在自己後端本地驗章。

---

## 0. 一分鐘心智模型

```
┌─────────────┐   1. 點登入，導去 auth    ┌──────────────────────┐
│  你的服務    │ ────────────────────────▶ │  auth.lvh.me (本服務)  │
│ foo.lvh.me  │                           │  - 跑 Google OAuth     │
│             │ ◀──────────────────────── │  - 簽 EdDSA JWT        │
└─────────────┘   2. 寫頂層 cookie 後導回   │  - 寫 cookie:           │
       │                                   │    Domain=.lvh.me      │
       │ 3. 你的「後端」讀 cookie            └──────────────────────┘
       │    用 JWKS 公鑰「本地驗章」                    │
       │                                               │ (只在啟動時抓一次)
       └───────────── 4. 認出使用者 ◀── JWKS 公鑰 ──────┘
                         （全程不回呼 auth）
```

關鍵設計：**非對稱簽章**。auth 用私鑰簽、你用公鑰驗。

- 私鑰永遠不出 auth；你只需要公鑰 → 你不可能洩漏發證能力。
- 驗章在你自己後端做，**不需要每次請求都打 auth** → auth 當機也不影響「已登入者」被你認出。
- cookie 的 `Domain` 是頂層 `.lvh.me`，所以**同一個生態系底下任何子網域都讀得到同一張通行證**。

---

## 1. 環境與網域（本測試階段的具體值）

| 角色 | 網址（本機測試階段） | 說明 |
| --- | --- | --- |
| 中央發證 auth | `https://auth.lvh.me:3000` | 本服務 |
| 範例消費端 portal | `https://portal.lvh.me:3001` | 門戶（同時是參考實作） |
| 你的服務 | `https://<你的子網域>.lvh.me:<port>` | 必須在 `*.lvh.me` 底下 |

> **為什麼是 `lvh.me`？** `lvh.me` 及其所有子網域由公共 DNS 直接解析到 `127.0.0.1`，
> 且 `.me` 是 Google OAuth 接受的公共 TLD（`.test`/`.local` 等保留 TLD 會被 Google 的
> redirect URI 驗證擋掉）。本機開發 **不需要改 `/etc/hosts`**。
>
> **上線後**這些網址會換成正式網域（例如 `auth.tschool.edu.tw`）。**所有網址都是 env 驅動的**
> （見 §10），所以你不該把網址寫死在邏輯裡——讀設定。

---

## 2. 契約速查（先看這張表）

| 項目 | 值 |
| --- | --- |
| **Cookie 名稱** | `tpass_session` |
| **Cookie 屬性** | `HttpOnly`、`Secure`、`SameSite=Lax`、`Domain=.lvh.me`、`Path=/`、`Max-Age=28800`（8 小時） |
| **簽章演算法** | `EdDSA`（Ed25519）— 驗章時**必須鎖死**這個 |
| **JWT header** | `{ "alg": "EdDSA", "kid": "tpass-key-1", "typ": "JWT" }` |
| **issuer（`iss`）** | `https://auth.lvh.me:3000` — 驗章時**必須檢查** |
| **audience（`aud`）** | `tschool-sso` — 驗章時**必須檢查** |
| **JWKS 公鑰來源** | `GET https://auth.lvh.me:3000/.well-known/jwks.json` |
| **登入入口** | `GET https://auth.lvh.me:3000/api/auth/login?redirect_uri=<你的完整網址>` |
| **登出入口** | `POST https://auth.lvh.me:3000/api/auth/logout?redirect_uri=<你的完整網址>`（選填） |
| **token 有效期** | 8 小時（`exp - iat`） |

---

## 3. JWT Payload 欄位定義

登入成功後，`tpass_session` cookie 的值是一個 JWT，其 payload 如下：

```json
{
  "sub": "104857600293847561029",
  "email": "b11302042@tschool.tp.edu.tw",
  "name": "林大明",
  "role": "student",
  "grade": null,
  "iss": "https://auth.lvh.me:3000",
  "aud": "tschool-sso",
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
| `grade` | `string \| null` | ✓ | 年級。目前 **一律 `null`**（待接學籍目錄）。注意型別是 `string` 不是 `number` |
| `iss` | `string` | ✓ | 簽發者，必為 §2 的 issuer |
| `aud` | `string` | ✓ | 受眾，必為 `tschool-sso` |
| `iat` | `number` | ✓ | 簽發時間（Unix 秒） |
| `exp` | `number` | ✓ | 到期時間（Unix 秒） |

> ⚠️ `role` / `grade` 目前是 placeholder（auth 端 `resolveClaims()` 寫死），等接上真實
> user directory 後才會有正確值。**你的程式要能容忍 `grade` 為 `null`、`role` 目前恆為 `student`。**
> 別硬編「一定有年級」之類的假設。

---

## 4. JWKS 公鑰格式

```
GET https://auth.lvh.me:3000/.well-known/jwks.json
Cache-Control: public, max-age=3600
```

回傳：

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "alg": "EdDSA",
      "use": "sig",
      "kid": "tpass-key-1",
      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"
    }
  ]
}
```

- `kid`（key id）用於**金鑰輪替**：未來 auth 換鑰時會同時提供新舊兩把、各有不同 `kid`，
  你的 JWT header 帶的 `kid` 決定要用哪把驗。**請用會「依 `kid` 自動選鑰」的函式庫**
  （`jose` 的 `createRemoteJWKSet`、PyJWT 的 `PyJWKClient` 都會），不要自己抓第一把硬用。
- 這裡 **只有公鑰**（`x`），沒有私鑰（`d`）。這是刻意的。
- 可以快取（`max-age=3600`），但**首次驗章前一定要抓得到**。`createRemoteJWKSet` 之類會自動快取 + 在遇到未知 `kid` 時重抓（含冷卻，避免被打爆）。

---

## 5. 驗章規則（安全關鍵，逐條必做）

驗一個 token 時，**一定**要同時滿足這四條，缺一不可：

1. **鎖演算法 `algorithms: ['EdDSA']`。**
   <br>❗ **不鎖 = 可被偽造任意身分。** 這叫 **algorithm confusion 攻擊**：攻擊者把 JWT header
   的 `alg` 改成對稱演算法（如 `HS256`），然後**拿你公開的 JWKS 公鑰位元組當 HMAC 密鑰**去簽一個
   假 token。如果你沒鎖演算法，驗章函式庫會「用公鑰當對稱密鑰」去驗——而公鑰是公開的，於是
   **任何人都能簽出 `role:"admin"` 的合法 token**。鎖死 `EdDSA` 就根本不會走到對稱那條路。
2. **檢查 `issuer` == `https://auth.lvh.me:3000`。** 確認票是「這個 auth」簽的，不是別的服務。
3. **檢查 `audience` == `tschool-sso`。** 確認票是發給「我們這個生態系」，不是別處的 token 被拿來重放。
4. **檢查 `exp` 沒過期。**（主流函式庫預設就會檢查，但要確認沒被你關掉。）

驗不過（過期 / 被竄改 / 錯 iss / 錯 aud / `alg` 不對 / 抓不到對應 `kid` 公鑰）→
**一律當成「未登入」**，顯示登入入口；**不要把例外訊息丟給前端**。

---

## 6. ⚠️ 最重要的限制：純前端 SPA 接不了，必須有後端

`tpass_session` 是 **`HttpOnly`** cookie ——這是刻意的安全設計（防 XSS 竊 token）。後果：

- ✅ **可以**讀它、驗它的地方：你的 **後端**——Server Component / Route Handler / Middleware /
  Express 或任何 server / BFF（Backend For Frontend）/ 邊緣函式。任何「能在伺服器端拿到 HTTP 請求
  的 Cookie header、又能驗 JWT」的環境都行。
- ❌ **不行**的地方：瀏覽器裡的 JavaScript。`document.cookie` **讀不到** `HttpOnly` cookie，
  `fetch` 也不會把它交給你的 JS。

**所以：如果你的服務是純前端 SPA（React/Vue 直接打 API、沒有自己的後端），你無法直接接這套 SSO。**
你必須**自備一層薄後端**：一個 endpoint（例如 `GET /api/me`）在 server 端讀 cookie、做 §5 驗章、
回 `{ user }` 給前端。前端再跟「自己的後端」要身分，而不是跟 auth 要。

---

## 7. 登入 / 登出流程

### 7.1 登入

當你的後端判定「沒有有效 session」時，把使用者導去登入入口。`redirect_uri` 必須是**完整網址**，
且 hostname 必須落在 `*.lvh.me`（或上線後的正式根網域）底下，否則 auth 回 **`400 Invalid redirect_uri`**
（這是防 Open Redirect 釣魚的白名單）。

```
https://auth.lvh.me:3000/api/auth/login?redirect_uri=https://foo.lvh.me:3002
```

整個流程：

```
你的服務 (未登入)
  → 302/連結 導去 auth /api/auth/login?redirect_uri=https://foo.lvh.me:3002
    → auth 307 導去 accounts.google.com（使用者在這裡按 Google 登入）
      → Google 導回 auth /api/auth/callback/google
        → auth 驗 email 網域、簽 JWT、寫 tpass_session cookie (Domain=.lvh.me)
          → auth 302 導回 https://foo.lvh.me:3002
            → 你的後端讀 cookie、本地驗章 → 認出使用者 ✅
```

HTML（最簡單）：

```html
<a href="https://auth.lvh.me:3000/api/auth/login?redirect_uri=https://foo.lvh.me:3002">
  使用學校 Google 帳號登入
</a>
```

JS（動態帶當前網址）：

```js
location.href =
  "https://auth.lvh.me:3000/api/auth/login?redirect_uri=" +
  encodeURIComponent(location.origin);
```

**登入可能的失敗**（auth 會導回它自己的首頁並帶 query，通常你不用處理，但知道一下）：
- `/?error=domain` — 使用者的 email 不在允許網域（目前只放行 `@tschool.tp.edu.tw`）。
- `/?error=oauth` — 跟 Google 換 token 或取 userinfo 失敗。

### 7.2 登出（整個生態系一起登出）

`POST` 到登出入口，auth 會清掉那張頂層 cookie（用相同的 name/domain/path，否則刪不掉）。
因為 cookie 是 `Domain=.lvh.me`，清掉後**整個生態系都登出**。

```html
<form method="post" action="https://auth.lvh.me:3000/api/auth/logout">
  <button type="submit">登出</button>
</form>
```

> 為什麼 `POST` + `<form>` 能帶到 cookie？因為 `foo.lvh.me` 與 `auth.lvh.me` 是**同站**
> （同一個註冊網域 `lvh.me`），`SameSite=Lax` 的 cookie 在同站請求（含 POST 表單送出）都會被帶上。
> 跨「不同註冊網域」才會被 Lax 擋。

**`redirect_uri`（選填）**：不帶時維持上面的舊行為——`303` 導回 auth 首頁。帶了的話，規則與
§7.1 登入的 `redirect_uri` 完全相同（必須是完整網址，hostname 落在 `*.lvh.me` 底下，否則
`400 Invalid redirect_uri`），登出後會 `303` 導回你自己的服務，而不是 auth 首頁：

```html
<form method="post" action="https://auth.lvh.me:3000/api/auth/logout?redirect_uri=https://foo.lvh.me:3002">
  <button type="submit">登出</button>
</form>
```

導回你的服務時，網址會多帶一個 `?logout=1`。**這只是畫面提示，不是身分憑證**——你只能在自己
已經用 §5 驗章確認「目前沒有有效 session」的前提下，拿它來決定要不要顯示「已登出」文案；
絕對不要用它來判斷登入狀態或做任何權限判斷，登入狀態永遠只能來自 cookie + 本地驗章。

---

## 8. 參考實作（可直接抄）

> 標準參考實作在 **`portal` 服務**：`../tpass-portal/src/lib/tpass-auth.ts`（驗章核心）、
> `../tpass-portal/src/config/portal.ts`（設定）、`../tpass-portal/src/app/page.tsx`（在 Server Component 用）。
> 下面是各 stack 的對應寫法。

### 8.1 Node / TypeScript（用 `jose`，**正規寫法**）

```bash
npm install jose
```

```ts
// lib/tpass-auth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://auth.lvh.me:3000";
const AUDIENCE = "tschool-sso";
const COOKIE_NAME = "tpass_session";

// createRemoteJWKSet：內建記憶體快取 + 依 kid 選鑰 + 金鑰輪替時自動重抓（含冷卻）。
// 模組層級建一次即可，不要每次請求都 new。
const JWKS = createRemoteJWKSet(
  new URL(`${ISSUER}/.well-known/jwks.json`),
);

export interface TPassClaims {
  sub: string;
  email: string;
  name: string;
  role: string;
  grade: string | null;
  exp: number;
}

// 驗一個 token，回 claims 或 null。永遠不要把 error 往外丟。
export async function verifySession(token: string): Promise<TPassClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA"],   // ★ 1. 鎖演算法（防 alg confusion）
      issuer: ISSUER,           // ★ 2. 檢查 iss
      audience: AUDIENCE,       // ★ 3. 檢查 aud（exp 由 jose 自動檢查 = 4）
    });
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      grade: (payload.grade as string | null) ?? null,
      exp: payload.exp as number,
    };
  } catch {
    return null; // 過期 / 竄改 / 錯 iss/aud / 錯 alg → 一律視為未登入
  }
}

// 從原始 Cookie header 取出我們的 token（依你的框架而定，見下方各範例）。
export function readToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return decodeURIComponent(v.join("="));
  }
  return null;
}
```

### 8.2 Next.js（App Router，Server Component）

```tsx
// app/page.tsx — 注意：沒有 "use client"，這是 server component
import { cookies } from "next/headers";
import { verifySession } from "@/lib/tpass-auth";

export default async function Page() {
  const token = (await cookies()).get("tpass_session")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const login =
      "https://auth.lvh.me:3000/api/auth/login?redirect_uri=" +
      encodeURIComponent("https://foo.lvh.me:3002");
    return <a href={login}>登入</a>;
  }
  return <p>哈囉 {session.name}（{session.email}）role={session.role}</p>;
}
```

### 8.3 Next.js（Middleware，保護整個路由群）

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/tpass-auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("tpass_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    const login = new URL("https://auth.lvh.me:3000/api/auth/login");
    login.searchParams.set("redirect_uri", req.nextUrl.origin);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] }; // 要保護的路徑
```

> ⚠️ Next.js middleware 跑在 Edge runtime。`jose` 支援 Edge（用 Web Crypto），沒問題。
> 但若你在 middleware 用其他只支援 Node 的 JWT 函式庫，要改用 Node runtime 或改在 route handler 驗。

### 8.4 Express（Node 後端）

```js
const express = require("express");
const cookieParser = require("cookie-parser");
const { createRemoteJWKSet, jwtVerify } = require("jose");

const ISSUER = "https://auth.lvh.me:3000";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

async function requireTPass(req, res, next) {
  const token = req.cookies["tpass_session"];
  if (!token) return res.redirect(loginUrl(req));
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA"],
      issuer: ISSUER,
      audience: "tschool-sso",
    });
    req.user = payload; // { sub, email, name, role, grade, ... }
    next();
  } catch {
    return res.redirect(loginUrl(req));
  }
}

function loginUrl(req) {
  const self = `${req.protocol}://${req.get("host")}`;
  return `${ISSUER}/api/auth/login?redirect_uri=${encodeURIComponent(self)}`;
}

const app = express();
app.use(cookieParser());
app.get("/dashboard", requireTPass, (req, res) => {
  res.send(`哈囉 ${req.user.name}`);
});
```

### 8.5 Python（FastAPI / Flask，用 PyJWT）

```bash
pip install "pyjwt[crypto]"   # EdDSA 需要 cryptography
```

```python
import jwt
from jwt import PyJWKClient

ISSUER = "https://auth.lvh.me:3000"
AUDIENCE = "tschool-sso"
jwks_client = PyJWKClient(f"{ISSUER}/.well-known/jwks.json")  # 依 kid 自動選鑰 + 快取

def verify_session(token: str) -> dict | None:
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA"],   # ★ 鎖演算法
            issuer=ISSUER,          # ★ 檢查 iss
            audience=AUDIENCE,      # ★ 檢查 aud（exp 預設檢查）
        )
    except Exception:
        return None

# FastAPI 範例：從 Cookie 取 token
# from fastapi import Cookie
# def me(tpass_session: str | None = Cookie(default=None)): ...
```

### 8.6 其他語言（通用演算法）

任何語言只要照這個流程，用該語言的 JOSE/JWT 函式庫實作即可：

```
1. 從請求的 Cookie header 取出名為 tpass_session 的值（沒有 → 未登入）。
2. 抓 https://auth.lvh.me:3000/.well-known/jwks.json（快取之；依 token header 的 kid 選對應公鑰）。
3. 用該公鑰驗 JWT，且：
     - 只允許演算法 EdDSA（Ed25519）          ← 不可省
     - issuer 必須等於 https://auth.lvh.me:3000 ← 不可省
     - audience 必須等於 tschool-sso           ← 不可省
     - 檢查 exp 未過期                          ← 不可省
4. 驗過 → 從 payload 取 sub/email/name/role/grade 當使用者身分。
5. 任何一步失敗 → 視為未登入，導去登入入口。
```

（Go 建議用 `github.com/lestrrat-go/jwx/v2/jwk` + `jwt`；Java 用 `nimbus-jose-jwt`；
PHP 用 `web-token/jwt-framework`。重點永遠是上面那四個「不可省」。）

---

## 9. 本機開發環境注意事項（這階段最容易踩雷的地方）

1. **信任 mkcert 根憑證。** 兩個服務都用 mkcert 簽的憑證跑 HTTPS。瀏覽器要信任 mkcert CA
   （`mkcert -install` 一次）。否則瀏覽器會擋。
2. **★ 你的後端 fetch JWKS 時，要讓 runtime 信任 mkcert CA。**
   <br>**Node 不讀作業系統的憑證信任區**，所以 server 端 `fetch` auth 的 HTTPS JWKS 會 TLS 失敗。
   解法：啟動時設環境變數
   ```bash
   NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" node server.js
   ```
   （本 repo 與 portal 的 `package.json` `start:https` script 就是這樣寫的。）
   <br>Python 同理：設 `SSL_CERT_FILE="$(mkcert -CAROOT)/rootCA.pem"` 或給 `PyJWKClient` 傳 ssl context。
   <br>**上線換成公開 CA（Let's Encrypt 等）後，這個環境變數就不需要了。**
3. **`lvh.me` 免改 `/etc/hosts`**（公共 DNS 已指向 127.0.0.1）。
4. **Next.js 沒有原生 HTTPS。** 若你也用 Next，需要一個 `server.mjs`（`node:https` 包
   Next 程式化 API）來跑 HTTPS——可直接抄本 repo 的 `server.mjs`。

---

## 10. 設定都是 env 驅動（不要寫死網址）

本服務所有可變值都集中在 `src/config/auth.ts`、來源是環境變數。**對接方也應如此**：把下列當設定，
不要散落在程式各處硬編。上線時只會換值，不該改邏輯。

| 你需要知道的設定 | 本階段值 | 上線會變 |
| --- | --- | --- |
| issuer / auth base URL | `https://auth.lvh.me:3000` | ✓ 換正式網域 |
| audience | `tschool-sso` | 可能不變 |
| JWKS URL | `<issuer>/.well-known/jwks.json` | 隨 issuer 變 |
| cookie 名稱 | `tpass_session` | 通常不變 |
| 允許的根網域（你的服務要在此之下） | `lvh.me` | ✓ 換正式根網域 |
| 允許登入的 email 網域 | `tschool.tp.edu.tw` | 可能擴充 |

---

## 11. 疑難排解（FAQ）

| 症狀 | 可能原因 / 解法 |
| --- | --- |
| 後端 fetch JWKS 報 TLS / `unable to verify ... certificate` | 沒設 `NODE_EXTRA_CA_CERTS`（見 §9.2） |
| 登入連結點下去回 `400 Invalid redirect_uri` | 你的 `redirect_uri` 不是完整網址、或 hostname 不在 `*.lvh.me` 底下；也要確認有 `https://` 與 port |
| 登入後回到你的服務卻還是「未登入」 | ①cookie 沒被你的後端讀到——確認你在 **server 端**讀，不是前端 JS；②`Domain` 對不上——確認你的服務在 `.lvh.me` 底下、且走 HTTPS（cookie 有 `Secure`）；③驗章 iss/aud 沒對齊 |
| 一直被導去 `/?error=domain` | 你登入用的 Google 帳號不是 `@tschool.tp.edu.tw` |
| 驗章一直失敗但 token 看起來正常 | 多半是**沒鎖 `algorithms:['EdDSA']`**、或 iss/aud 字串對不上（注意有沒有 port、結尾斜線） |
| token 過幾小時就失效 | 正常，TTL 8 小時；過期後使用者要重新登入 |
| 純前端 React 拿不到 cookie | 正常，`HttpOnly` 本來就讀不到；你需要一層後端（見 §6） |

---

## 12. 給 AI agent 的實作指令

> 如果你是被指派「把某服務接上 T-Pass SSO」的 coding agent，照下面做。

**前置確認（先問人類或檢查專案）：**
1. 這個服務**有沒有後端**？（Server Component / API routes / Express / FastAPI…）
   - 沒有、是純前端 SPA → **停下來告訴使用者**：必須先加一層後端（§6），否則接不了。
2. 這個服務跑在哪個網域？必須在 `*.lvh.me`（本機）或正式根網域底下，且走 HTTPS。
3. 用什麼語言/框架？→ 對照 §8 選實作範本。

**實作步驟：**
1. 安裝 JOSE/JWT 函式庫（Node: `jose`；Python: `pyjwt[crypto]`）。
2. 建一個設定模組，集中放：issuer `https://auth.lvh.me:3000`、audience `tschool-sso`、
   cookie 名 `tpass_session`、JWKS URL、登入/登出 URL（全部從 env 讀，給預設值）。
3. 建驗章模組 `verifySession(token)`：用 `createRemoteJWKSet`/`PyJWKClient`，
   `jwtVerify` 鎖 `algorithms:['EdDSA']` + 檢查 `issuer` + `audience`，失敗回 null。
   **這三個檢查一個都不能少**（理由見 §5）。
4. 在 server 端（route / middleware / server component）讀 `tpass_session` cookie → `verifySession`。
5. 未登入 → 導去 `https://auth.lvh.me:3000/api/auth/login?redirect_uri=<本服務完整網址>`。
6. 登出 → `POST https://auth.lvh.me:3000/api/auth/logout`（用 `<form method="post">`）。
7. 本機跑 HTTPS 時，啟動命令帶 `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`（§9.2）。

**完工前自我驗收（不需 Google 也能測）：**
- [ ] `algorithms` 確實鎖成 `['EdDSA']`（grep 程式碼確認，不是用預設）。
- [ ] issuer、audience 都有檢查，且字串與 §2 完全一致（含 port、無多餘斜線）。
- [ ] cookie 在**後端**讀，前端 JS 沒有試圖讀 `tpass_session`。
- [ ] 抓得到 JWKS：`NODE_EXTRA_CA_CERTS=... curl <JWKS URL>` 或在程式裡 fetch 成功，
      內容含 `kid:"tpass-key-1"`、`alg:"EdDSA"`、`kty:"OKP"`、`crv:"Ed25519"`。
- [ ] 對「過期 token / 竄改一個字元的 token / aud 改錯的 token / header alg 改成 HS256 用公鑰簽的 token」
      四種，`verifySession` 都回 null。（這組測試見本 repo / portal 的驗證腳本作法。）
- [ ] 未登入時頁面顯示登入連結，連結的 `redirect_uri` 是本服務完整網址。

**絕對不要做：**
- ❌ 不要嘗試自動化 Google 登入（會被 bot 偵測擋、違反條款）。需要真人登入時，停下來請使用者手動完成。
- ❌ 不要 import 或複製 auth 的私鑰、`arctic`、OAuth callback 程式。消費端**只需要公鑰**。
- ❌ 不要在前端驗章、不要把 token 塞進 `localStorage`、不要關掉 `algorithms` 鎖定。
```
