// 權限資料存取層：簽章路徑與 panel 都不直接碰 Prisma，只透過這裡。
// email 一律小寫正規化——Subject.email 存的也是小寫，查找鍵才對得上。
import "server-only";
import { prisma } from "@/lib/db";
import type { Grant, Prisma, Subject } from "@prisma/client";

export function findGrant(email: string, serviceId: string): Promise<Grant | null> {
  return prisma.grant.findFirst({
    where: { serviceId, subject: { email: email.toLowerCase() } },
  });
}

export function findAllGrants(email: string): Promise<Grant[]> {
  return prisma.grant.findMany({
    where: { subject: { email: email.toLowerCase() } },
  });
}

// ── panel 用查詢（Phase 2）──────────────────────────────────────────────

export function findSubjectByEmail(email: string): Promise<Subject | null> {
  return prisma.subject.findUnique({ where: { email: email.toLowerCase() } });
}

export type SubjectWithGrants = Subject & { grants: Grant[] };

export function findSubjectWithGrants(email: string): Promise<SubjectWithGrants | null> {
  return prisma.subject.findUnique({
    where: { email: email.toLowerCase() },
    include: { grants: true },
  });
}

export function createSubject(email: string): Promise<Subject> {
  return prisma.subject.create({ data: { email: email.toLowerCase() } });
}

// 登入成功時呼叫（callback/google/route.ts）：回填 sub/name、更新 lastSeenAt。
// email 是查找鍵——panel 可能已經先用 email 建過 Subject（人還沒登入過），
// 這裡用 upsert 讓「先建後登入」與「先登入後被管理」兩條路徑收斂成同一筆 row。
export function upsertSubjectOnLogin(input: {
  email: string;
  sub: string;
  name: string;
}): Promise<Subject> {
  const email = input.email.toLowerCase();
  return prisma.subject.upsert({
    where: { email },
    create: { email, sub: input.sub, name: input.name, lastSeenAt: new Date() },
    update: { sub: input.sub, name: input.name, lastSeenAt: new Date() },
  });
}

// 人員列表：email 搜尋（contains，小寫）＋分頁。
export async function listSubjects(opts: {
  query?: string;
  page: number;
  pageSize: number;
}): Promise<{ subjects: SubjectWithGrants[]; total: number }> {
  const where: Prisma.SubjectWhereInput = opts.query
    ? { email: { contains: opts.query.trim().toLowerCase() } }
    : {};
  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      include: { grants: true },
      orderBy: { email: "asc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.subject.count({ where }),
  ]);
  return { subjects, total };
}

export function countSubjects(): Promise<number> {
  return prisma.subject.count();
}

// 建立或更新一筆 Grant（saveGrant action 唯一寫入口）。
export function upsertGrant(input: {
  subjectId: string;
  serviceId: string;
  role: string;
  restriction: string;
  reason: string | null;
  expiresAt: Date | null;
  updatedBy: string;
}): Promise<Grant> {
  return prisma.grant.upsert({
    where: { subjectId_serviceId: { subjectId: input.subjectId, serviceId: input.serviceId } },
    create: {
      subjectId: input.subjectId,
      serviceId: input.serviceId,
      role: input.role,
      restriction: input.restriction,
      reason: input.reason,
      expiresAt: input.expiresAt,
      updatedBy: input.updatedBy,
    },
    update: {
      role: input.role,
      restriction: input.restriction,
      reason: input.reason,
      expiresAt: input.expiresAt,
      updatedBy: input.updatedBy,
    },
  });
}

// ban 時呼叫（saveGrant）：把 Subject.sessionsValidFrom 設為 now()——早於這個時間簽出的
// auth session 全部失效，被 ban 者的 SSO 態立刻死亡，換不到任何新的 per-service 票
// （已發出去的舊票仍活到各自 TTL，見 session.ts getSession 的比對邏輯）。
export function touchSessionsValidFrom(subjectId: string): Promise<Subject> {
  return prisma.subject.update({
    where: { id: subjectId },
    data: { sessionsValidFrom: new Date() },
  });
}

export function findGrantByServiceAndSubject(
  subjectId: string,
  serviceId: string,
): Promise<Grant | null> {
  return prisma.grant.findUnique({
    where: { subjectId_serviceId: { subjectId, serviceId } },
  });
}

export type GrantWithSubject = Grant & { subject: Subject };

// 服務視角：這個服務裡「有故事」的 Grant（角色非 default 或管制非 none）。
// 到期的管制仍會回傳（原始 DB 值）——由呼叫端用 toEntry 判斷是否已失效。
export function listGrantsForService(serviceId: string): Promise<GrantWithSubject[]> {
  return prisma.grant.findMany({
    where: {
      serviceId,
      OR: [{ role: { not: "default" } }, { restriction: { not: "none" } }],
    },
    include: { subject: true },
    orderBy: { updatedAt: "desc" },
  });
}

// 總覽統計：各服務 admin/moderator 數（角色不受到期影響，不用篩 expiresAt）。
export function roleStats() {
  return prisma.grant.groupBy({
    by: ["serviceId", "role"],
    where: { role: { not: "default" } },
    _count: true,
  });
}

// 總覽統計：目前「生效中」的管制數（warning/ban），過期的不算——
// 過期只是 DB 欄位還沒被下次編輯覆蓋，語意上已經解除了。
export function restrictionStats() {
  const now = new Date();
  return prisma.grant.groupBy({
    by: ["restriction"],
    where: {
      restriction: { not: "none" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _count: true,
  });
}

export function listRecentAuditLogs(limit: number) {
  return prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: limit });
}

export async function listAuditLogs(opts: {
  targetEmail?: string;
  serviceId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.targetEmail ? { targetEmail: opts.targetEmail.trim().toLowerCase() } : {}),
    ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
  };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, total };
}
