"use client";

// SidebarNav — client component for active link detection.
// Lives inside the server Sidebar component.
// Uses usePathname() to highlight the current active route.

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
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Phase this module becomes active — grayed out until then */
  activePhase: 1 | 2 | 3 | 4 | 5;
};

// Navigation items mirror the modules seed data (00003_seed_modules.sql).
const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard",   label: "דשבורד",          icon: LayoutDashboard, activePhase: 1 },
  { href: "/admin/companies",   label: "ניהול חברות",      icon: Building2,       activePhase: 1 },
  { href: "/admin/departments", label: "ניהול מחלקות",     icon: Network,         activePhase: 1 },
  { href: "/admin/role-tags",   label: "תגיות תפקיד",      icon: Tags,            activePhase: 1 },
  { href: "/admin/employees",   label: "ניהול עובדים",     icon: Users,           activePhase: 2 },
  { href: "/admin/users",       label: "ניהול יוזרים",     icon: UserCog,         activePhase: 3 },
  { href: "/admin/templates",   label: "תבניות הרשאות",    icon: Shield,          activePhase: 3 },
  { href: "/admin/projects",    label: "ניהול פרויקטים",   icon: FolderKanban,    activePhase: 4 },
  { href: "/admin/settings",    label: "הגדרות מערכת",     icon: Settings,        activePhase: 5 },
];

// Current phase — items below this phase are greyed out and non-interactive.
const CURRENT_PHASE = 1;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const isDisabled = item.activePhase > CURRENT_PHASE;
        const Icon = item.icon;

        if (isDisabled) {
          return (
            // Grayed-out placeholder for future phases — no interactivity.
            <div
              key={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 opacity-40 cursor-not-allowed select-none"
              aria-disabled="true"
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          );
        }

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
