// 已登入但不是 auth 服務 moderator/admin 時的畫面（抄 tpass-form 的 Forbidden 樣式）。
import { ShieldX } from "lucide-react";
import { authConfig } from "@/config/auth";

export function Forbidden({
  message = "管理面板只開放給 auth 服務的版主／管理員。",
}: {
  message?: string;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-tone-rose-bg text-tone-rose-text shadow-[4px_4px_0_0_var(--color-foreground)]">
        <ShieldX className="h-8 w-8" />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">沒有權限</h1>
      <p className="mt-2 font-medium text-muted-foreground">{message}</p>
      <a
        href={authConfig.portalUrl}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-4 py-2 font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
      >
        回門戶大廳
      </a>
    </div>
  );
}
