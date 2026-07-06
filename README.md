# T-Pass SSO 發證服務（tpass-auth）

TSchool 生態系的中央登入服務：跑 Google OAuth 確認身分 → 對白名單服務簽發
per-service EdDSA JWT（`aud=tpass:<id>`，契約 v2）→ 公開 JWKS 公鑰。
**全生態唯一持有簽章私鑰的服務**；消費端只拿公鑰本地驗章，不回呼本服務。

| 項目 | 值 |
| --- | --- |
| 服務 id | `auth`（tpass-ops `services.json`） |
| 本機網址 | `https://auth.lvh.me:3000` |
| 正式網址 | `https://auth.tschoolsu.org` |
| 資料庫 | 無 |
| 對接合約 | **`INTEGRATION.md`（本 repo，權威）** |

## 開發

一律從上層 tpass-ops repo 啟動：

```bash
# 上層目錄
scripts/tpass dev auth      # 或 tpass dev（全部服務）
scripts/tpass check auth    # push 前：lint + tsc --noEmit
```

**禁止裸 `npm run dev`。** env 必填清單以 `src/config/auth.ts` 的 `REQUIRED` 為準
（範本 `.env.example`）；EdDSA 金鑰用 `node scripts/gen-keys.mjs` 產（不落盤、不進 git）。

## 結構速記

- `src/app/api/auth/login` — 啟動 Google OAuth（state + PKCE，arctic）
- `src/app/api/auth/callback/google` — 換 token、驗 email 網域、簽 session
- `src/app/api/auth/authorize` — **契約 v2 核心**：對白名單服務簽 per-service token（form_post 交付）
- `src/app/api/auth/logout` — 清 v1/v2 session cookie
- `src/app/.well-known/jwks.json` — 公鑰（kid 支援輪替）
- `src/lib/session.ts` — 簽/驗章集中地；`src/config/auth.ts` — 全 env 驅動設定

## 安全紅線

私鑰只存在 `.env.local` 的 `JWT_PRIVATE_KEY`；`AUTH_SERVICE_IDS` 是服務白名單；
`redirect_uri` 一律過 `isAllowedRedirect` 白名單。細節與威脅模型見
`INTEGRATION.md` 與上層 `docs/SECURITY-REVIEW.md`。
