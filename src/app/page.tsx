// T-Pass 登入頁。這不是門戶，只是發證服務的登入入口。
// auth 不是使用者的目的地：已持有通行證的人被單獨導到這裡，直接送回門戶大廳。
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { authConfig } from "@/config/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(authConfig.portalUrl);
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-sm rounded-2xl border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--color-foreground)] sm:p-8">
        <div className="mb-8 text-center">
          <span className="font-mono text-3xl font-extrabold tracking-tight text-foreground">
            T<span className="text-primary">-</span>Pass
          </span>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            校園核心服務通行證
          </p>
        </div>

        <div className="space-y-4">
          {error === "domain" && (
            <p className="rounded-md border-2 border-foreground bg-tone-rose-bg px-4 py-3 text-center text-sm font-bold text-tone-rose-text">
              此帳號不在授權範圍，請使用學校帳號登入。
            </p>
          )}
          {error === "oauth" && (
            <p className="rounded-md border-2 border-foreground bg-tone-rose-bg px-4 py-3 text-center text-sm font-bold text-tone-rose-text">
              登入過程發生問題，請再試一次。
            </p>
          )}
          <a
            href="/api/auth/login"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-foreground bg-card px-4 py-3 text-center text-sm font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
            </svg>
            使用學校 Google 帳號登入
          </a>
        </div>
      </div>
    </main>
  );
}
