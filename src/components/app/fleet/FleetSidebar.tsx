"use client";

// FleetSidebar — collapsible RTL sidebar for the fleet module.
// Renders 9 sub-modules with permission-based enable/disable.
// Collapsed to icon-only by default (defaultOpen={false}).
// side="right" positions sidebar on RTL logical start.
//
// Permission model:
//   - Server passes string[] (JSON-serializable across server→client boundary)
//   - Client converts to Set<string> for O(1) lookup per item
//   - Items missing from permSet: grayed, non-clickable, aria-disabled, tabIndex={-1}
//
// Styling: uses brand color tokens from globals.css via shadcn --sidebar-* vars
// (--sidebar = #1B3A4B bg, --sidebar-foreground = #E8EAED text,
//  --sidebar-accent = #2A4F63 hover, --sidebar-primary = #4ECDC4 active)

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  Fuel,
  SquareActivity,
  Receipt,
  Zap,
  MapPin,
  KeyRound,
  ClipboardList,
  AlertTriangle,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Sub-module Config ────────────────────────────────────────────────────────
// Static list of 9 fleet sub-modules (Sharon, session #16 characterization).
// Keys must match module_key values in the modules table.
// Order determines sidebar rendering order.

type FleetSubModule = {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
};

const FLEET_SUB_MODULES: FleetSubModule[] = [
  {
    key: "app_fleet_fuel",
    label: "דלק",
    href: "/app/fleet/fuel",
    icon: Fuel,
  },
  {
    key: "app_fleet_tolls",
    label: "כבישי אגרה",
    href: "/app/fleet/tolls",
    icon: SquareActivity,
  },
  {
    key: "app_fleet_invoices",
    label: "חשבוניות ספקים",
    href: "/app/fleet/invoices",
    icon: Receipt,
  },
  {
    key: "app_fleet_ev_charging",
    label: "טעינת רכב חשמלי",
    href: "/app/fleet/ev-charging",
    icon: Zap,
  },
  {
    key: "app_fleet_charging_stations",
    label: "מעקב עמדות טעינה פרטיות",
    href: "/app/fleet/charging-stations",
    icon: MapPin,
  },
  {
    key: "app_fleet_rentals",
    label: "הזמנת רכב שכור",
    href: "/app/fleet/rentals",
    icon: KeyRound,
  },
  {
    key: "app_fleet_forms",
    label: "טפסים",
    href: "/app/fleet/forms",
    icon: ClipboardList,
  },
  {
    key: "app_fleet_exceptions",
    label: "טבלת חריגים",
    href: "/app/fleet/exceptions",
    icon: AlertTriangle,
  },
  {
    key: "app_fleet_reports",
    label: "דוחות",
    href: "/app/fleet/reports",
    icon: BarChart2,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type FleetSidebarProps = {
  // string[] (not Set) — Sets are not JSON-serializable across server→client boundary.
  // Server (FleetLayout) filters and passes array; client converts to Set for O(1) lookup.
  permissions: string[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FleetSidebar({ permissions }: FleetSidebarProps) {
  // Convert to Set once per prop change — O(1) has() for each item render
  const permSet = useMemo(() => new Set(permissions), [permissions]);

  const pathname = usePathname();

  return (
    // SidebarProvider scoped to fleet layout only — NOT in (app)/layout.tsx.
    // defaultOpen={false} = collapsed to icon-only on initial render (Sharon spec).
    <SidebarProvider defaultOpen={false}>
      {/* side="right" = RTL logical start (matches dir="rtl" on <html>) */}
      {/* collapsible="icon" = collapses to icon-only width, SidebarMenuButton shows tooltip */}
      <Sidebar side="right" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider px-2 py-1">
              צי רכב
            </SidebarGroupLabel>
            <SidebarMenu>
              {FLEET_SUB_MODULES.map((item) => {
                const isEnabled = permSet.has(item.key);
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                if (isEnabled) {
                  // Enabled item — full link with active state
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isActive}
                        className={cn(
                          "transition-colors duration-200",
                          isActive &&
                            "border-r-2 border-sidebar-primary text-sidebar-primary"
                        )}
                      >
                        <a href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Disabled item — grayed, non-clickable, keyboard-inaccessible
                // Uses <span> (not <a> or <button>) so keyboard focus is impossible.
                // aria-disabled="true" communicates disabled state to screen readers.
                // tabIndex={-1} removes from Tab order entirely.
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={`${item.label} — אין גישה`}
                      className="opacity-40 cursor-not-allowed"
                      aria-disabled="true"
                      tabIndex={-1}
                    >
                      <span aria-hidden="true">
                        <Icon />
                      </span>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
