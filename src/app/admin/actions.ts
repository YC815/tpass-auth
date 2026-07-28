"use server";
// 後台唯一的寫入口。全走 server actions，不開 REST 管理端點。
// 每支都自己重新呼叫 requireAuthModerator/requireAuthAdmin——layout 只負責畫面，
// 擋不住有人直接呼叫這支函式（例如繞過 UI 直接打 server action 的網路請求）。
import { revalidatePath } from "next/cache";
import { requireAuthModerator } from "@/lib/admin-guard";
import { authConfig } from "@/config/auth";
import {
  findSubjectByEmail,
  createSubject as createSubjectRow,
  findGrantByServiceAndSubject,
  upsertGrant,
  touchSessionsValidFrom,
} from "@/lib/permissions/repo";
import { recordAudit } from "@/lib/audit";
import type { Restriction, Role } from "@/lib/permissions/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ROLES: readonly Role[] = ["admin", "moderator", "default"];
const RESTRICTIONS: readonly Restriction[] = ["none", "warning", "ban"];
const ROLE_RANK: Record<Role, number> = { default: 0, moderator: 1, admin: 2 };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // 夠用就好：擋掉明顯打錯的字串，不追求完整 RFC 5322。
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validServiceId(serviceId: string): boolean {
  return serviceId === "auth" || authConfig.serviceIds.includes(serviceId);
}

// ── createSubject ────────────────────────────────────────────────────
// 建 Subject 只需要 email——人不必登入過（沒繳錢的先 ban 起來等他來）。
export async function createSubjectAction(
  emailRaw: string,
): Promise<ActionResult & { email?: string }> {
  await requireAuthModerator();

  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) return { ok: false, error: "email 格式不正確" };

  const existing = await findSubjectByEmail(email);
  if (existing) return { ok: false, error: "此 email 已經存在" };

  await createSubjectRow(email);
  revalidatePath("/admin/people");
  revalidatePath("/admin");
  return { ok: true, email };
}

// ── saveGrant ────────────────────────────────────────────────────────
export interface SaveGrantInput {
  email: string;
  serviceId: string;
  role: Role;
  restriction: Restriction;
  reason: string;
  // datetime-local 字串（"2026-08-01T12:00"）或空字串／null＝不設到期。
  expiresAt: string | null;
}

export async function saveGrant(input: SaveGrantInput): Promise<ActionResult> {
  const { session, perm } = await requireAuthModerator();

  const email = normalizeEmail(input.email);
  const serviceId = input.serviceId;
  const reason = input.reason.trim();

  // ── 輸入驗證（白名單，不信任前端傳來的字面值）──
  if (!validServiceId(serviceId)) return { ok: false, error: "不明的服務 id" };
  if (!ROLES.includes(input.role)) return { ok: false, error: "不明的角色" };
  if (!RESTRICTIONS.includes(input.restriction)) return { ok: false, error: "不明的管制狀態" };
  if (input.restriction !== "none" && !reason) {
    return { ok: false, error: "警告／禁止瀏覽必須填寫原因" };
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "到期時間格式錯誤" };
    expiresAt = d;
  }

  // ── 業務規則：不可對 superadmin 做任何變更 ──
  if (authConfig.superadmins.includes(email)) {
    return { ok: false, error: "此帳號是生態總管（AUTH_SUPERADMINS），不可調整" };
  }

  const subject = await findSubjectByEmail(email);
  if (!subject) return { ok: false, error: "找不到這位使用者，請先建立" };

  const existing = await findGrantByServiceAndSubject(subject.id, serviceId);
  const currentRole: Role = (existing?.role as Role | undefined) ?? "default";

  // ── 業務規則：moderator 不可改 role ──
  if (perm.role !== "admin" && input.role !== currentRole) {
    return { ok: false, error: "版主只能調整管制狀態，不能調整角色" };
  }

  // ── 業務規則：不可調低自己在 auth 的角色（防鎖門）──
  if (
    serviceId === "auth" &&
    email === session.email.toLowerCase() &&
    ROLE_RANK[input.role] < ROLE_RANK[currentRole]
  ) {
    return { ok: false, error: "不可調低自己在 auth 的角色，會鎖住管理面板" };
  }

  const before = existing
    ? {
        role: existing.role,
        restriction: existing.restriction,
        reason: existing.reason,
        expiresAt: existing.expiresAt?.toISOString() ?? null,
      }
    : null;

  const grant = await upsertGrant({
    subjectId: subject.id,
    serviceId,
    role: input.role,
    restriction: input.restriction,
    reason: input.restriction === "none" ? null : reason,
    expiresAt,
    updatedBy: session.email,
  });

  const after = {
    role: grant.role,
    restriction: grant.restriction,
    reason: grant.reason,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
  };

  // ban 生效：Subject.sessionsValidFrom 設為 now()——讓被 ban 者的 auth 登入態立刻死亡
  // （getSession 會拒絕早於此時間 iat 的 token），不必等現有 session 自然過期才失去 SSO 能力。
  if (input.restriction === "ban") {
    await touchSessionsValidFrom(subject.id);
  }

  // ── 稽核：依實際變動內容分開記，一次存檔可能同時觸發多種 action ──
  // 用「目前有效值」比較（沒有 existing row 時等同 default/none），不是「有沒有 existing row」——
  // 否則對從沒被動過的人存一次全預設值也會生出假的 role.change 稽核噪音。
  const currentRestriction = existing?.restriction ?? "none";
  const roleChanged = currentRole !== grant.role;
  const restrictionChanged = currentRestriction !== grant.restriction;
  const onlyMetaChanged =
    !roleChanged &&
    !restrictionChanged &&
    existing !== null &&
    (existing.reason !== grant.reason ||
      existing.expiresAt?.getTime() !== grant.expiresAt?.getTime());

  const auditActions: string[] = [];
  if (roleChanged) auditActions.push("role.change");
  if (restrictionChanged) {
    auditActions.push(grant.restriction === "none" ? "restriction.clear" : "restriction.set");
  }
  if (onlyMetaChanged) auditActions.push("grant.edit");

  for (const action of auditActions) {
    await recordAudit({
      actorEmail: session.email,
      targetEmail: email,
      serviceId,
      action,
      before,
      after,
    });
  }

  revalidatePath(`/admin/people/${encodeURIComponent(email)}`);
  revalidatePath("/admin/people");
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin/audit");
  revalidatePath("/admin");

  return { ok: true };
}
