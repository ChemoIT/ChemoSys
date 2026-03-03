"use client";

// SidebarNav — client component for active link detection.
// Lives inside the server Sidebar component.
// Uses usePathname() to highlight the current active route.
// All nav items are always shown — admin interface is Sharon-only.
// moduleKey on each item maps to modules.key in DB (useful for future ChemoSys use).

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Network,
  Tags,
  Users,
  UserCog,
  Shield,
  FolderKanban,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Maps to modules.key in the DB — used for permission filtering */
  moduleKey: string;
};

// Navigation items mirror the modules seed data (00003_seed_modules.sql).
const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard",   label: "דשבורד",          icon: LayoutDashboard, moduleKey: "dashboard" },
  { href: "/admin/companies",   label: "ניהול חברות",      icon: Building2,       moduleKey: "companies" },
  { href: "/admin/departments", label: "ניהול מחלקות",     icon: Network,         moduleKey: "departments" },
  { href: "/admin/role-tags",   label: "תגיות תפקיד",      icon: Tags,            moduleKey: "role_tags" },
  { href: "/admin/employees",   label: "ניהול עובדים",     icon: Users,           moduleKey: "employees" },
  { href: "/admin/users",       label: "ניהול יוזרים",     icon: UserCog,         moduleKey: "users" },
  { href: "/admin/templates",   label: "תבניות הרשאות",    icon: Shield,          moduleKey: "templates" },
  { href: "/admin/projects",    label: "ניהול פרויקטים",   icon: FolderKanban,    moduleKey: "projects" },
  { href: "/admin/audit-log",   label: "יומן פעולות",      icon: ScrollText,      moduleKey: "audit_log" },
  { href: "/admin/settings",    label: "הגדרות מערכת",     icon: Settings,        moduleKey: "settings" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 space-y-1">
      {NAV_ITEMS
        .map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 transition-colors",
                isActive
                  ? "bg-sidebar-active/20 text-sidebar-active"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-sidebar-active" : "text-sidebar-text/70"
                )}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
