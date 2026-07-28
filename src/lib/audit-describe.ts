// 把 AuditLog 一列翻成人話。
//
// 存在的理由：稽核頁是「誰把我 ban 的」這種爭議的證據畫面，但欄位原本只印 role.change、
// restriction.set 這些機器代號，加一坨 raw JSON——只有寫這套系統的人看得懂。
//
// before/after 是 Prisma 的 Json（型別上等同 unknown），可能來自舊版格式或人工改過的資料。
// 一律防禦性取值，解不出來就回退成原始 action 代號——稽核頁不該因為一筆畸形資料整頁炸掉。
import { ROLE_LABEL, RESTRICTION_LABEL } from "@/components/admin/PermBadge";
import type { Role, Restriction } from "@/lib/permissions/types";
import { formatDateTime } from "@/lib/format-time";

interface GrantSnapshot {
  role?: string;
  restriction?: string;
  reason?: string | null;
  expiresAt?: string | null;
  grants?: unknown[];
}

function snapshot(value: unknown): GrantSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as GrantSnapshot;
}

function roleLabel(raw: string | undefined): string {
  return raw && raw in ROLE_LABEL ? ROLE_LABEL[raw as Role] : (raw ?? "使用者");
}

function restrictionLabel(raw: string | undefined): string {
  return raw && raw in RESTRICTION_LABEL ? RESTRICTION_LABEL[raw as Restriction] : (raw ?? "—");
}

export interface AuditRow {
  action: string;
  serviceId: string;
  before: unknown;
  after: unknown;
}

// 回傳一句描述。呼叫端負責把 serviceId 用等寬字標出來，這裡只給文字。
export function describeAudit(row: AuditRow): string {
  const before = snapshot(row.before);
  const after = snapshot(row.after);

  switch (row.action) {
    case "role.change": {
      // before 為 null＝這個服務原本連 Grant 都沒有（見 actions.ts 的批次稽核）。
      const from = before ? roleLabel(before.role) : "使用者";
      return `把角色從「${from}」改為「${roleLabel(after?.role)}」`;
    }
    case "restriction.set": {
      const what = restrictionLabel(after?.restriction);
      const parts = [`設下「${what}」`];
      if (after?.reason) parts.push(`原因：${after.reason}`);
      if (after?.expiresAt) {
        const d = new Date(after.expiresAt);
        if (!Number.isNaN(d.getTime())) parts.push(`到期：${formatDateTime(d)}`);
      }
      return parts.join("，");
    }
    case "restriction.clear":
      return `解除管制（原本是「${restrictionLabel(before?.restriction)}」）`;
    case "grant.edit":
      return "修改管制的原因或到期時間";
    case "subject.delete": {
      const n = Array.isArray(before?.grants) ? before.grants.length : 0;
      return `刪除此人員，一併移除 ${n} 個服務的權限紀錄`;
    }
    default:
      return row.action; // 未知代號照原樣顯示，不要假裝看得懂
  }
}
