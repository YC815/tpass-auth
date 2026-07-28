// /denied：ban 頁。authorize 路由查到 restriction=ban（未過期）時導來這裡，
// 只帶 ?service=<id>——reason 絕不進 query string，這裡憑 session 重查 DB 取得。
// 無 session → 不揭露任何資訊，直接送回首頁（會再導去登入）。
// 有 session 但這服務其實沒被 ban（沒紀錄／已過期／service id 不明）→ 送回門戶，不留在這頁。
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { authConfig } from "@/config/auth";

export const metadata: Metadata = { title: "拒絕存取 — T-Pass" };
import { permissionsFor } from "@/lib/permissions/resolve";
// 時間格式化本來寫在這個檔裡（連同「不要相信 locale 預設輸出」的理由）。
// 後台也需要同一套，已抽到 lib/format-time.ts——不要在這裡再長第二份出來。
import { formatDateTimeFromUnix, formatTimeFromUnix } from "@/lib/format-time";

// 獨立成 helper（而非直接在 component 內呼叫 Date.now()）：react-hooks/purity 規則
// 禁止在 component render body 內直接呼叫不純函式；包一層即可，語意不變。
function staleUntil(ttlSeconds: number): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

const LINK_BASE =
  "flex items-center justify-center rounded-xl border-2 border-foreground px-4 py-3 text-center text-sm font-bold shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]";

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/");

  const serviceId = service ?? "";
  if (!authConfig.serviceIds.includes(serviceId)) redirect(authConfig.portalUrl);

  const perm = await permissionsFor(session.email, serviceId);
  // 沒被 ban（從沒被管制過／已過期／中途被解封）→ 這頁對他不成立，送回門戶而不是留白畫面。
  if (perm.read) redirect(authConfig.portalUrl);

  const staleUntilSeconds = staleUntil(authConfig.jwt.ttlSeconds);

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
      {/* 滿版 dotted grid（design.md 的 hero pattern），加深不透明度呼應「很猛」的要求 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.7]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklch, var(--color-foreground) 20%, transparent) 1.6px, transparent 1.6px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(80% 70% at 50% 0%, black, transparent)",
        }}
      />

      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="font-mono text-sm font-bold tracking-[0.3em] text-tone-rose-text">
            T-PASS // 403 FORBIDDEN
          </p>
          <h1 className="mt-2 font-mono text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl">
            Access
            <br />
            Denied
          </h1>
        </div>

        <div className="rounded-2xl border-2 border-foreground bg-foreground p-6 text-[oklch(0.99_0_0)] shadow-[6px_6px_0_0_var(--color-tone-rose-badge)] sm:p-7">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-tone-rose-badge">
            服務
          </p>
          <p className="mt-1 font-mono text-lg font-extrabold">{serviceId}</p>

          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-widest text-tone-rose-badge">
            原因
          </p>
          <p className="mt-1 text-lg font-bold">「{perm.reason || "未提供原因"}」</p>

          {perm.until && (
            <>
              <p className="mt-5 font-mono text-xs font-bold uppercase tracking-widest text-tone-rose-badge">
                解封時間
              </p>
              <p className="mt-1 font-mono font-bold">{formatDateTimeFromUnix(perm.until)}</p>
            </>
          )}
        </div>

        <p className="rounded-md border-2 border-foreground bg-tone-orange-bg px-4 py-3 text-center text-sm font-bold text-tone-orange-text">
          若你仍能開啟 {serviceId} 的部分頁面，那是尚未過期的舊通行證，最晚 {formatTimeFromUnix(staleUntilSeconds)} 失效。
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {authConfig.appealUrl && (
            <a href={authConfig.appealUrl} className={`${LINK_BASE} bg-accent text-primary-foreground`}>
              提出申訴
            </a>
          )}
          <a href={authConfig.portalUrl} className={`${LINK_BASE} bg-card text-foreground`}>
            回門戶
          </a>
          <form action="/api/auth/logout" method="post" className="contents">
            <button type="submit" className={`${LINK_BASE} w-full bg-destructive text-primary-foreground`}>
              登出
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
