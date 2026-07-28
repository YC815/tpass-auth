"use client";
// 刪除人員（僅 admin 可見）。刪除不是封鎖——會連同所有服務的管制紀錄一起消失，
// 所以對「目前有生效中管制」的人多警告一句，避免有人拿刪除當作處分手段。
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSubjectAction } from "@/app/admin/actions";
import { Card, Button } from "@/components/admin/primitives";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export function DangerZone({
  email,
  grantCount,
  activeRestrictionCount,
}: {
  email: string;
  grantCount: number;
  activeRestrictionCount: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function doDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSubjectAction(email);
      if (!result.ok) {
        setConfirmOpen(false);
        setError(result.error);
        return;
      }
      router.push("/admin/people");
      router.refresh();
    });
  }

  return (
    <Card className="border-destructive">
      <h2 className="font-extrabold text-lg text-tone-rose-text">危險操作</h2>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        刪除此人員會一併刪掉他在 {grantCount} 個服務的權限紀錄。
        這不是封鎖——他下次登入會被重新建立成一筆全新的乾淨紀錄。要擋人請用「禁止瀏覽」。
      </p>
      {error && <p className="mt-3 font-mono text-xs font-bold text-destructive">{error}</p>}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="mt-4"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        刪除此人員
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title={`確定要刪除 ${email} 嗎？`}
        message={
          <>
            將刪除他在 {grantCount} 個服務的權限紀錄，此動作無法復原（只會留在稽核紀錄裡）。
            {activeRestrictionCount > 0 && (
              <>
                <br />
                <strong className="text-tone-rose-text">
                  注意：他目前有 {activeRestrictionCount} 筆生效中的管制，刪除後等同全部解除。
                </strong>
              </>
            )}
          </>
        }
        confirmLabel="確定刪除"
        destructive
        pending={pending}
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
