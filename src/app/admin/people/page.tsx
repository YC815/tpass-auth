// /admin/people：人員列表＋分頁＋email 搜尋。
import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { listSubjects } from "@/lib/permissions/repo";
import { Card, Input, Button } from "@/components/admin/primitives";
import { PermBadge } from "@/components/admin/PermBadge";
import type { Role, Restriction } from "@/lib/permissions/types";

const PAGE_SIZE = 20;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const { subjects, total } = await listSubjects({ query: q, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = (extra: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(extra)) params.set(k, String(v));
    return `/admin/people?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">人員</h1>
          <p className="mt-1 font-medium text-muted-foreground">共 {total} 位。</p>
        </div>
        <Link href="/admin/people/new">
          <Button variant="primary">
            <UserPlus className="h-4 w-4" />
            新增人員
          </Button>
        </Link>
      </div>

      <form action="/admin/people" method="get" className="flex max-w-md gap-2">
        <Input type="search" name="q" defaultValue={q ?? ""} placeholder="搜尋 email…" aria-label="搜尋 email" />
        <Button type="submit" variant="default">
          <Search className="h-4 w-4" />
          搜尋
        </Button>
      </form>

      <Card className="overflow-x-auto">
        {subjects.length === 0 ? (
          <p className="font-medium text-muted-foreground">
            {q ? `找不到符合「${q}」的人員。` : "還沒有任何人員。"}
          </p>
        ) : (
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">Email</th>
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">姓名</th>
                <th className="py-2 font-mono text-xs font-bold text-muted-foreground">權限</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const notable = s.grants.filter(
                  (g) => g.role !== "default" || g.restriction !== "none",
                );
                return (
                  <tr key={s.id} className="border-b border-foreground/10 last:border-0">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/people/${encodeURIComponent(s.email)}`}
                        className="font-mono text-xs font-bold hover:underline"
                      >
                        {s.email}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-medium">{s.name ?? "—"}</td>
                    <td className="py-2">
                      {notable.length === 0 ? (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-2">
                          {notable.map((g) => (
                            <span key={g.id} className="inline-flex items-center gap-1">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {g.serviceId}
                              </span>
                              <PermBadge
                                role={g.role as Role}
                                restriction={g.restriction as Restriction}
                              />
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {page <= 1 ? (
            <Button variant="default" size="sm" disabled>
              上一頁
            </Button>
          ) : (
            <Link href={query({ page: page - 1 })}>
              <Button variant="default" size="sm">
                上一頁
              </Button>
            </Link>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            第 {page} / {totalPages} 頁
          </span>
          {page >= totalPages ? (
            <Button variant="default" size="sm" disabled>
              下一頁
            </Button>
          ) : (
            <Link href={query({ page: page + 1 })}>
              <Button variant="default" size="sm">
                下一頁
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
