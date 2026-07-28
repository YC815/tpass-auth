// 使用者看得到的錯誤畫面（authorize 的設定錯誤、404）。
// AGENTS.md 的分工：auth 的可見畫面統一在 auth 維護，不推給消費端——
// 但 authorize 的幾個 400 原本是回裸文字，使用者只會看到白底一行英文。
//
// hint 是給「串接的人」看的排錯線索（多半是部員在照 NEW-SERVICE 流程接新服務時撞到），
// 不含任何機密：service id 與 redirect_uri 都是使用者自己送進來的值。
import { ShieldAlert } from "lucide-react";
import { authConfig } from "@/config/auth";

export function ErrorPage({
  code,
  title,
  message,
  hint,
}: {
  code: string;
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--color-foreground)] sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-foreground bg-tone-orange-bg text-tone-orange-text shadow-[3px_3px_0_0_var(--color-foreground)]">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            T-PASS // {code}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-3 font-medium text-muted-foreground">{message}</p>
          {hint && (
            <p className="mt-4 rounded-md border-2 border-foreground bg-muted px-3 py-2 font-mono text-xs font-bold text-foreground">
              {hint}
            </p>
          )}
          <a
            href={authConfig.portalUrl}
            className="mt-6 inline-flex items-center justify-center rounded-xl border-2 border-foreground bg-card px-4 py-2 font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
          >
            回門戶大廳
          </a>
        </div>
      </div>
    </main>
  );
}
