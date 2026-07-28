"use client";
// 單一服務的 role + restriction 編輯列。ban 需二次確認；reason 在 restriction≠none 時必填；
// 存檔成功後顯示「最晚於 HH:MM 生效」（權限變更不即時撤銷既有 per-service token）。
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGrant } from "@/app/admin/actions";
import type { Restriction, Role } from "@/lib/permissions/types";
import { Button, Input, Label } from "@/components/admin/primitives";
import { RoleSelect, ROLE_RANK } from "@/components/admin/RoleSelect";
import { RestrictionSelect } from "@/components/admin/RestrictionSelect";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EffectiveAtNotice } from "@/components/admin/EffectiveAtNotice";
import { RoleBadge } from "@/components/admin/PermBadge";

// Grant.expiresAt (Date | null) → <input type="datetime-local"> 需要的字串（本地時間，無秒）。
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GrantRow({
  email,
  serviceId,
  initialRole,
  initialRestriction,
  initialReason,
  initialExpiresAt,
  canChangeRole,
  minRoleRank,
  ttlSeconds,
}: {
  email: string;
  serviceId: string;
  initialRole: Role;
  initialRestriction: Restriction;
  initialReason: string;
  initialExpiresAt: string | null; // ISO
  canChangeRole: boolean;
  minRoleRank: number;
  ttlSeconds: number;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [restriction, setRestriction] = useState<Restriction>(initialRestriction);
  const [reason, setReason] = useState(initialReason);
  const [expiresAt, setExpiresAt] = useState(toLocalInputValue(initialExpiresAt));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveAt, setEffectiveAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function doSave() {
    setError(null);
    setEffectiveAt(null);
    startTransition(async () => {
      const result = await saveGrant({
        email,
        serviceId,
        role,
        restriction,
        reason,
        expiresAt: expiresAt || null,
      });
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEffectiveAt(Math.floor(Date.now() / 1000) + ttlSeconds);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (restriction !== "none" && !reason.trim()) {
      setError("警告／禁止瀏覽必須填寫原因");
      return;
    }
    if (restriction === "ban") {
      setConfirmOpen(true);
      return;
    }
    doSave();
  }

  return (
    <li className="border-b-2 border-dashed border-foreground/30 py-5 last:border-0">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold">{serviceId}</span>
          {!canChangeRole && <RoleBadge role={role} />}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>角色</Label>
            {canChangeRole ? (
              <RoleSelect
                value={role}
                onChange={setRole}
                minRank={minRoleRank}
                className="mt-1"
              />
            ) : (
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                版主不可調整角色。
              </p>
            )}
          </div>
          <div>
            <Label>管制狀態</Label>
            <RestrictionSelect value={restriction} onChange={setRestriction} className="mt-1" />
          </div>
        </div>

        {restriction !== "none" && (
          <div>
            <Label htmlFor={`${serviceId}-reason`}>原因（必填）</Label>
            <Input
              id={`${serviceId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="mt-1"
              placeholder="給當事人與其他管理員看的原因"
            />
          </div>
        )}

        <div>
          <Label htmlFor={`${serviceId}-expires`}>到期時間（選填）</Label>
          <Input
            id={`${serviceId}-expires`}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 max-w-xs"
          />
        </div>

        {error && <p className="font-mono text-xs font-bold text-destructive">{error}</p>}
        {effectiveAt && <EffectiveAtNotice effectiveAtSeconds={effectiveAt} />}

        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "儲存中…" : "儲存"}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={`確定要禁止 ${email} 瀏覽 ${serviceId} 嗎？`}
        message={
          <>
            原因：「{reason.trim() || "（未填寫）"}」
            <br />
            此人在此服務的通行證換發（authorize）會被擋下並導向 /denied 頁；
            他目前手上已發出的舊通行證仍會活到各自的 TTL（最晚數十分鐘）才失效。
          </>
        }
        confirmLabel="確定禁止瀏覽"
        destructive
        pending={pending}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}

// 外部（page.tsx）需要 ROLE_RANK 決定 minRoleRank，避免各處重複定義角色排序。
export { ROLE_RANK };
