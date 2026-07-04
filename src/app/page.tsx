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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            T-Pass
          </h1>
          <p className="mt-2 text-sm text-zinc-400">校園核心服務通行證</p>
        </div>

        <div className="space-y-4">
          {error === "domain" && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
              此帳號不在授權範圍，請使用學校帳號登入。
            </p>
          )}
          {error === "oauth" && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
              登入過程發生問題，請再試一次。
            </p>
          )}
          <a
            href="/api/auth/login"
            className="block w-full rounded-lg bg-indigo-500 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-400"
          >
            使用學校 Google 帳號登入
          </a>
        </div>
      </div>
    </main>
  );
}
