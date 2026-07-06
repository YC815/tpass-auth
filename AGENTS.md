<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## auth 不是使用者的目的地（UI 設計說明）

auth 只是發證服務，不是門戶。使用者理想上只會看到 **Google 自己的登入介面**，而不是 tauth 的頁面：

- **已登入**者連到 auth 根路徑 → `page.tsx` 直接 `redirect(portalUrl)`，導回門戶大廳。
- **未登入**者連到根路徑 → 顯示 auth 自己的登入頁（一顆「使用學校 Google 帳號登入」按鈕）。
- **登入失敗 / 網域不符**（`callback/google/route.ts` 的 `fail()`）→ `redirect('/?error=oauth|domain')`，
  回到 `page.tsx` 顯示錯誤 banner。

因此登入頁與錯誤頁是使用者**可能看到的少數 tauth 畫面**。它們一律維護成 **light-only Neobrutalism**
（與 `tpass-portal/docs/design.md` 一致：`border-2 border-foreground` + hard offset shadow、OKLCH token、light body），
色彩 token 移植在本專案 `src/app/globals.css`。**不要**把「處理 auth 錯誤 / 登入」的 UI 推給各消費端自行實作——
那違反「消費端只驗章、不碰發證 UI」的分工紅線；auth 的可見畫面就在 auth 這裡統一維護。

## 生態系地圖在上層

本 repo 是 **tpass 生態系**的發證端（id：`auth`）。整個生態系的地圖、跨服務規範、
`services.json` 註冊表、`tpass` CLI 與部署流程，都在上層 **tpass-ops** repo 的
`AGENTS.md` 與 `docs/`。對接合約以本 repo `INTEGRATION.md` 為權威。

- 本機啟動一律用上層的 `scripts/tpass dev auth`（禁止裸 `npm run dev`）。
