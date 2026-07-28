// 權限解析層：簽章路徑（signServiceToken）唯一入口。
// 呼叫端只認 permissionsFor / overviewFor 這兩支函式，不直接碰 repo 或 Prisma。
import "server-only";
import { authConfig } from "@/config/auth";
import { findAllGrants, findGrant } from "./repo";
import type { PermissionEntry, PermissionMap, Role } from "./types";

const DEFAULT_ENTRY: PermissionEntry = { read: true, role: "default" };
const SUPERADMIN_ENTRY: PermissionEntry = { read: true, role: "admin" };

// DB 查詢失敗時的降級：fail-open——全鎖會連救火的人都進不去；
// superadmin 走 env（見上）不受 DB 影響，這裡只影響一般 Grant 查詢。
function degraded(context: string, err: unknown): PermissionEntry {
  console.error(`[permissions] ${context} 失敗，降級為預設權限（fail-open）：`, err);
  return { ...DEFAULT_ENTRY };
}

type GrantLike = {
  role: string;
  restriction: string;
  reason: string | null;
  expiresAt: Date | null;
};

// Grant row → 對外契約 PermissionEntry。
// expiresAt 的語意是「管制到期」：過了就當作沒有管制，但 role 保留——
// 到期只是解除 ban/warning，不是撤銷角色。
export function toEntry(grant: GrantLike | null): PermissionEntry {
  if (!grant) return { ...DEFAULT_ENTRY };
  const role = grant.role as Role;
  const expired = grant.expiresAt !== null && grant.expiresAt.getTime() <= Date.now();
  const restriction = expired ? "none" : grant.restriction;
  const entry: PermissionEntry = {
    read: restriction !== "ban",
    role,
  };
  if (restriction !== "none") {
    entry.restriction = restriction as PermissionEntry["restriction"];
    if (grant.reason) entry.reason = grant.reason;
    if (grant.expiresAt) entry.until = Math.floor(grant.expiresAt.getTime() / 1000);
  }
  return entry;
}

// 某人在某服務的權限（簽 per-service token 時查這支）。
export async function permissionsFor(
  email: string,
  serviceId: string,
): Promise<PermissionEntry> {
  const normalized = email.toLowerCase();
  if (authConfig.superadmins.includes(normalized)) return { ...SUPERADMIN_ENTRY };
  try {
    return toEntry(await findGrant(normalized, serviceId));
  } catch (err) {
    return degraded(`permissionsFor(${normalized}, ${serviceId})`, err);
  }
}

// 某人在所有服務的權限總覽（大廳 token／panel 用；Phase 4 才接上簽章，先寫好）。
export async function overviewFor(email: string): Promise<PermissionMap> {
  const normalized = email.toLowerCase();
  const serviceIds = [...new Set([...authConfig.serviceIds, "auth"])];
  if (authConfig.superadmins.includes(normalized)) {
    return Object.fromEntries(serviceIds.map((id) => [id, { ...SUPERADMIN_ENTRY }]));
  }
  try {
    const grants = await findAllGrants(normalized);
    const bySvc = new Map(grants.map((g) => [g.serviceId, g]));
    return Object.fromEntries(
      serviceIds.map((id) => [id, toEntry(bySvc.get(id) ?? null)]),
    );
  } catch (err) {
    degraded(`overviewFor(${normalized})`, err);
    return Object.fromEntries(serviceIds.map((id) => [id, { ...DEFAULT_ENTRY }]));
  }
}
