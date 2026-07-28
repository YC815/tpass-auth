// role / restriction 的視覺化徽章：admin=violet、moderator=blue、warning=orange、ban=rose。
// role="default" 且 restriction="none"（沒有故事的一列）不畫任何徽章，回傳 null——
// 列表頁大量顯示時，沒事的人不該佔視覺重量。
import type { Restriction, Role } from "@/lib/permissions/types";
import { cn } from "./primitives";

const ROLE_LABEL: Record<Role, string> = {
  admin: "管理員",
  moderator: "版主",
  default: "使用者",
};

const ROLE_TONE: Record<Exclude<Role, "default">, string> = {
  admin: "bg-tone-violet-badge text-tone-violet-text",
  moderator: "bg-tone-blue-badge text-tone-blue-text",
};

const RESTRICTION_LABEL: Record<Restriction, string> = {
  none: "正常",
  warning: "警告",
  ban: "禁止瀏覽",
};

const RESTRICTION_TONE: Record<Exclude<Restriction, "none">, string> = {
  warning: "bg-tone-orange-badge text-tone-orange-text",
  ban: "bg-tone-rose-badge text-tone-rose-text",
};

function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border-2 border-foreground px-2 py-0.5 font-mono text-[11px] font-bold",
        tone,
      )}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  if (role === "default") return null;
  return <Chip tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Chip>;
}

export function RestrictionBadge({ restriction }: { restriction: Restriction }) {
  if (restriction === "none") return null;
  return <Chip tone={RESTRICTION_TONE[restriction]}>{RESTRICTION_LABEL[restriction]}</Chip>;
}

// 兩個徽章併排；都沒有時畫一個灰階「—」，讓表格欄位不會看起來像漏資料。
export function PermBadge({ role, restriction }: { role: Role; restriction: Restriction }) {
  if (role === "default" && restriction === "none") {
    return <span className="font-mono text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RoleBadge role={role} />
      <RestrictionBadge restriction={restriction} />
    </span>
  );
}

export { ROLE_LABEL, RESTRICTION_LABEL };
