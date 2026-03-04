"use client";

// ModuleSwitcher — dropdown for switching between ChemoSys top-level modules.
// Receives the user's app_* permissions array from the server (AppHeader).
// Only renders the modules the user is permitted to access.
// Hidden entirely when the user has access to only one (or zero) modules —
// single-module users are auto-redirected and don't need a switcher.
//
// RTL note: align="start" positions the dropdown to the logical start side,
// which in RTL layout is the right side of the viewport.

import Link from "next/link";
import { Truck, HardHat, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ModuleConfig = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

// Top-level module keys — order determines dropdown order.
const TOP_LEVEL_MODULES = ["app_fleet", "app_equipment"] as const;

// Configuration for each module: label (Hebrew), route, and icon.
const MODULE_MAP: Record<string, ModuleConfig> = {
  app_fleet: {
    label: "צי רכב",
    href: "/app/fleet",
    icon: <Truck className="h-4 w-4 shrink-0" />,
  },
  app_equipment: {
    label: 'צמ"ה',
    href: "/app/equipment",
    icon: <HardHat className="h-4 w-4 shrink-0" />,
  },
};

type ModuleSwitcherProps = {
  permissions: string[];
};

export function ModuleSwitcher({ permissions }: ModuleSwitcherProps) {
  // Filter to only top-level modules the user has access to.
  const available = TOP_LEVEL_MODULES.filter((key) =>
    permissions.includes(key)
  );

  // No switcher needed for single-module (or zero-module) users.
  // Auto-redirect handles single-module users at the /app level.
  if (available.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sidebar-text hover:text-sidebar-text hover:bg-sidebar-hover"
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          {/* Label hidden on small screens — icon is sufficient on mobile */}
          <span className="hidden sm:inline">מודולים</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        {available.map((key) => {
          const mod = MODULE_MAP[key];
          if (!mod) return null;
          return (
            <DropdownMenuItem key={key} asChild>
              <Link href={mod.href} className="flex items-center gap-2 cursor-pointer">
                {mod.icon}
                <span>{mod.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
