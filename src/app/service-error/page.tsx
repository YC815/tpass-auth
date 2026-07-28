// /service-error：authorize 因為「串接設定不對」而擋下時導來這裡。
// 原本這三種情況是直接回裸文字 400（"Unknown service" 之類），使用者只看到白底一行英文。
//
// 為什麼用導向而不是在 route handler 裡回 HTML：route handler 回不了 JSX，硬回 HTML 就
// 拿不到 layout 的字體與 Tailwind。而 authorize 一定是瀏覽器的頂層導航（SSO 流程的一步），
// 從來不是 server-to-server 呼叫，所以損失 400 狀態碼沒有實質代價。
import type { Metadata } from "next";
import { ErrorPage } from "@/components/ErrorPage";

export const metadata: Metadata = { title: "服務串接有問題 — T-Pass" };

// 每個 code 對應 authorize 裡的一道檢查。hint 是給串接的人看的排錯線索——
// 多半是部員照 docs/NEW-SERVICE.md 接新服務時撞到的第一個坑。
const REASONS: Record<string, { title: string; message: string; hint: string }> = {
  "unknown-service": {
    title: "這個服務還沒登記",
    message: "T-Pass 不認得這個服務代號，因此不會為它發出通行證。",
    hint: "串接者：把服務 id 加進 auth 的 AUTH_SERVICE_IDS，並確認 services.json 也登記了。",
  },
  "invalid-redirect": {
    title: "服務的回呼位址不被信任",
    message: "這個服務要求把通行證送到不在生態系網域內的位址，已被擋下。",
    hint: "串接者：redirect_uri 必須位於 AUTH_ALLOWED_HOST_SUFFIX 的網域底下。",
  },
  "invalid-next": {
    title: "轉跳位址不合法",
    message: "登入完成後要前往的位址不是一個站內路徑，已被擋下。",
    hint: "串接者：next 必須是以單一斜線開頭的站內路徑，例如 /dashboard。",
  },
};

const FALLBACK = {
  title: "無法前往這個服務",
  message: "T-Pass 無法為這次請求發出通行證。",
  hint: "串接者：請檢查 authorize 的 service / redirect_uri / next 三個參數。",
};

export default async function ServiceErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const r = (reason && REASONS[reason]) || FALLBACK;
  return <ErrorPage code="400 BAD REQUEST" title={r.title} message={r.message} hint={r.hint} />;
}
