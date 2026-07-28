// /admin/audit：稽核紀錄列表＋分頁，可依 targetEmail / serviceId 過濾。
import { authConfig } from "@/config/auth";
import { listAuditLogs } from "@/lib/permissions/repo";
import { Card, Input, Select, Button, Label } from "@/components/admin/primitives";

const PAGE_SIZE = 30;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ targetEmail?: string; serviceId?: string; page?: string }>;
}) {
  const { targetEmail, serviceId, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const serviceIds = [...new Set([...authConfig.serviceIds, "auth"])];

  const { logs, total } = await listAuditLogs({
    targetEmail,
    serviceId,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">稽核紀錄</h1>
        <p className="mt-1 font-medium text-muted-foreground">共 {total} 筆。</p>
      </div>

      <form action="/admin/audit" method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="targetEmail">對象 email</Label>
          <Input
            id="targetEmail"
            name="targetEmail"
            defaultValue={targetEmail ?? ""}
            placeholder="留空＝全部"
            className="mt-1 w-56"
          />
        </div>
        <div>
          <Label htmlFor="serviceId">服務</Label>
          <Select id="serviceId" name="serviceId" defaultValue={serviceId ?? ""} className="mt-1 w-40">
            <option value="">全部</option>
            {serviceIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary">
          篩選
        </Button>
      </form>

      <Card className="overflow-x-auto">
        {logs.length === 0 ? (
          <p className="font-medium text-muted-foreground">沒有符合條件的紀錄。</p>
        ) : (
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">時間</th>
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">操作者</th>
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">對象</th>
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">服務</th>
                <th className="py-2 pr-4 font-mono text-xs font-bold text-muted-foreground">動作</th>
                <th className="py-2 font-mono text-xs font-bold text-muted-foreground">詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-foreground/10 last:border-0 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {log.at.toLocaleString("zh-Hant-TW")}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{log.actorEmail}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{log.targetEmail}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{log.serviceId}</td>
                  <td className="py-2 pr-4 font-mono text-xs font-bold">{log.action}</td>
                  <td className="py-2">
                    <details>
                      <summary className="cursor-pointer font-mono text-xs text-accent">
                        變更內容
                      </summary>
                      <pre className="mt-2 max-w-xs overflow-x-auto rounded-md border-2 border-foreground/20 bg-muted p-2 font-mono text-[10px]">
                        {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <PaginationLinks
          page={page}
          totalPages={totalPages}
          targetEmail={targetEmail}
          serviceId={serviceId}
        />
      )}
    </div>
  );
}

function PaginationLinks({
  page,
  totalPages,
  targetEmail,
  serviceId,
}: {
  page: number;
  totalPages: number;
  targetEmail?: string;
  serviceId?: string;
}) {
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (targetEmail) params.set("targetEmail", targetEmail);
    if (serviceId) params.set("serviceId", serviceId);
    params.set("page", String(p));
    return `/admin/audit?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between">
      {page <= 1 ? (
        <Button variant="default" size="sm" disabled>
          上一頁
        </Button>
      ) : (
        <a href={hrefFor(page - 1)}>
          <Button variant="default" size="sm">
            上一頁
          </Button>
        </a>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        第 {page} / {totalPages} 頁
      </span>
      {page >= totalPages ? (
        <Button variant="default" size="sm" disabled>
          下一頁
        </Button>
      ) : (
        <a href={hrefFor(page + 1)}>
          <Button variant="default" size="sm">
            下一頁
          </Button>
        </a>
      )}
    </div>
  );
}
