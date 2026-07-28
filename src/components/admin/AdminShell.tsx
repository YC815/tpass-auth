// 後台外殼：頂列（Logo + 目前登入者 email + 登出）＋側欄／tab bar 導覽。
// 抄 tpass-form/src/components/admin/AdminShell.tsx 的版面結構。
import Link from "next/link";
import { AdminSidebar, AdminTabBar } from "./AdminNav";

export function AdminShell({
  email,
  serviceIds,
  children,
}: {
  email: string;
  serviceIds: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 h-16 border-b-2 border-foreground/20 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin" className="font-mono text-lg font-extrabold tracking-tight text-foreground">
            T<span className="text-primary">-</span>Pass
            <span className="ml-2 align-middle rounded-md border-2 border-foreground bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
              ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground sm:inline">
              {email}
            </span>
            <form method="post" action="/api/auth/logout">
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminTabBar serviceIds={serviceIds} />

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <AdminSidebar serviceIds={serviceIds} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
