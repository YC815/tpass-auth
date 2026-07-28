"use client";
// 角色下拉。minRank 用來擋「自己在 auth 調低自己角色」——不給選比目前低的選項，
// 比等送出才被 server action 拒絕更早、更清楚（server 端仍是最終防線，這裡只是 UX）。
import type { Role } from "@/lib/permissions/types";
import { Select } from "./primitives";
import { ROLE_LABEL } from "./PermBadge";

const ROLE_RANK: Record<Role, number> = { default: 0, moderator: 1, admin: 2 };
const ROLES: Role[] = ["default", "moderator", "admin"];

export function RoleSelect({
  value,
  onChange,
  disabled,
  minRank = 0,
  className,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  minRank?: number;
  className?: string;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      className={className}
      onChange={(e) => onChange(e.target.value as Role)}
    >
      {ROLES.filter((r) => ROLE_RANK[r] >= minRank).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </Select>
  );
}

export { ROLE_RANK };
