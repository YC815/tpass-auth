"use client";
// 後台導覽（抄 tpass-form 的雙形態：桌機 sidebar／手機 tab bar，共用同一份 items）。
// serviceIds 由 server 端（AdminShell）傳入——authConfig 是 server-only，client 元件不能直接 import。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ScrollText, Boxes, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; mono?: boolean };

function isActive(pathname: string | null, href: string) {
  return href === "/admin" ? pathname === "/admin" : (pathname ?? "").startsWith(href);
}

function itemsFor(serviceIds: string[]): Item[] {
  return [
    { href: "/admin", label: "總覽", icon: LayoutDashboard },
    { href: "/admin/people", label: "人員", icon: Users },
    ...serviceIds.map((id) => ({
      href: `/admin/services/${id}`,
      label: id,
      icon: Boxes,
      mono: true,
    })),
    { href: "/admin/audit", label: "稽核", icon: ScrollText },
  ];
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 border-foreground px-3 py-2 text-sm font-bold shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className={item.mono ? "font-mono" : ""}>{item.label}</span>
    </Link>
  );
}

export function AdminSidebar({ serviceIds }: { serviceIds: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden w-48 shrink-0 flex-col gap-2 md:flex">
      {itemsFor(serviceIds).map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}
    </nav>
  );
}

export function AdminTabBar({ serviceIds }: { serviceIds: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-16 z-40 border-b-2 border-foreground/20 bg-background/90 backdrop-blur-md md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {itemsFor(serviceIds).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}
