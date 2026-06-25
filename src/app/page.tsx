// T-Pass 登入頁。這不是門戶，只是發證服務的登入入口。
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
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

        {session ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-white/5 px-4 py-3 text-center text-sm text-zinc-200">
              已登入：{session.name}
              <span className="block text-xs text-zinc-500">
                {session.email}
              </span>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-lg border border-white/15 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
              >
                登出
              </button>
            </form>
            <p className="text-center text-xs text-zinc-500">
              你已持有通行證，可直接前往各校園服務
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </main>
  );
}
