// /admin 守門：未登入 → 導去自己的 Google 登入（回來後落回 /admin）；
// 已登入但非 auth 服務 moderator/admin → 顯示 Forbidden（不渲染後台）。
// 注意：這裡只負責「渲染什麼畫面」，不是安全的唯一防線——server action 可被直接打，
// 每個 action 內部都要重新呼叫 requireAuthModerator/requireAuthAdmin（見 lib/admin-guard.ts）。
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "權限管理 — T-Pass" };
import { getAuthPerm } from "@/lib/admin-guard";
import { authConfig } from "@/config/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { Forbidden } from "@/components/admin/Forbidden";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    const loginUrl = new URL("/api/auth/login", authConfig.baseUrl);
    loginUrl.searchParams.set("redirect_uri", `${authConfig.baseUrl}/admin`);
    redirect(loginUrl.toString());
  }

  const perm = await getAuthPerm(session);
  if (perm.role !== "admin" && perm.role !== "moderator") {
    return <Forbidden />;
  }

  // "auth" 本身不在 AUTH_SERVICE_IDS 白名單裡（那是消費端 id 清單），但它也是一個
  // 有 Grant 的服務——沿用 resolve.ts 的 serviceIds ∪ {"auth"} 慣例。
  const serviceIds = [...new Set([...authConfig.serviceIds, "auth"])];

  return (
    <AdminShell
      email={session.email}
      serviceIds={serviceIds}
      canBulk={perm.role === "admin"}
    >
      {children}
    </AdminShell>
  );
}
