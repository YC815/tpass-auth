// /admin panel 守門：panel 授權就是這套模型自己（serviceId="auth" 的 Grant）——
// 「管理面板預設只有管理員能進」不是另一套規則，是套用同一套 permissionsFor。
import "server-only";
import { getSession, type TPassClaims } from "@/lib/session";
import { permissionsFor } from "@/lib/permissions/resolve";
import type { PermissionEntry } from "@/lib/permissions/types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// 某人在 auth 這個「服務」自己身上的權限（superadmin 覆寫、Grant(serviceId="auth") 查找、
// DB 掛掉 fail-open 全部沿用 permissionsFor 既有邏輯，panel 不重寫一份會飄掉的判斷）。
export function getAuthPerm(session: TPassClaims): Promise<PermissionEntry> {
  return permissionsFor(session.email, "auth");
}

export interface AdminActor {
  session: TPassClaims;
  perm: PermissionEntry;
}

// 給 server action 用：自己讀 getSession()，未登入或角色不足一律拋錯，
// 由呼叫端（action 本身）決定怎麼回應——layout 擋不住直接打 action，
// 所以每個 server action 內部都要重新呼叫這支，不能只信 layout 擋過一次。
export async function requireAuthModerator(): Promise<AdminActor> {
  const session = await getSession();
  if (!session) throw new ForbiddenError("尚未登入");
  const perm = await getAuthPerm(session);
  if (perm.role !== "admin" && perm.role !== "moderator") {
    throw new ForbiddenError("沒有權限");
  }
  return { session, perm };
}

export async function requireAuthAdmin(): Promise<AdminActor> {
  const actor = await requireAuthModerator();
  if (actor.perm.role !== "admin") throw new ForbiddenError("需要管理員權限");
  return actor;
}

// 頁面層用：只問「這個瀏覽者是不是 admin」，不 throw。
// layout 已經擋掉未登入與非版主，這裡只負責再分出 admin／moderator 的差別，
// 決定要不要渲染只有管理員能用的入口——把版主看得到卻按不動的按鈕藏起來。
export async function viewerIsAuthAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const perm = await getAuthPerm(session);
  return perm.role === "admin";
}
