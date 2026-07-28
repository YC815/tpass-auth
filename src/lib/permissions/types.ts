// 權限層對外契約：serviceId → PermissionEntry。跟未來 JWT `permissions` claim 同型別
// （這個 phase 不簽發 claim，但先把型別定下來，簽章路徑與 panel 都靠它）。
export type Role = "admin" | "moderator" | "default";
export type Restriction = "none" | "warning" | "ban";

export interface PermissionEntry {
  read: boolean; // 必有。唯一必看欄位，auth 算好（= restriction !== "ban"）
  role: Role; // 必有。admin 隱含 moderator
  restriction?: Restriction; // 省略 = none
  reason?: string; // 只在 restriction !== "none" 時出現
  until?: number; // 選填 Unix 秒，管制到期自動解除
}

export type PermissionMap = Record<string, PermissionEntry>;
