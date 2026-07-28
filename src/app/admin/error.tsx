"use client";
// /admin 子樹的錯誤安全網。在此之前這裡一個 error.tsx 都沒有——任何未預期的 throw
// （DB 斷線、Prisma 查詢炸掉）都會掉到 Next 預設畫面，正式環境只會顯示一句英文。
// 權限不足不會走到這裡：那條路徑已在 server action 內被轉成可顯示的回值（見 actions.ts 的 gate）。
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, Button } from "@/components/admin/primitives";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] 未預期的錯誤：", error);
  }, [error]);

  return (
    <Card className="border-destructive">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-foreground bg-tone-rose-bg text-tone-rose-text shadow-[3px_3px_0_0_var(--color-foreground)]">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-extrabold tracking-tight">這一頁出了點問題</h1>
      <p className="mt-2 font-medium text-muted-foreground">
        後台讀取資料時發生未預期的錯誤，通常是資料庫連線問題。權限本身沒有被改動。
      </p>
      {/* digest 是 Next 給這次錯誤的識別碼，正式環境不會顯示訊息內容——留著讓人回報時有東西可對。 */}
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">錯誤代碼：{error.digest}</p>
      )}
      <Button type="button" variant="primary" size="sm" className="mt-5" onClick={reset}>
        重試
      </Button>
    </Card>
  );
}
