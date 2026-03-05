"use client";

// FleetSidebar — collapsible RTL sidebar shell for the fleet module.
// Wraps BOTH the sidebar AND the content area in SidebarProvider (required by shadcn).
//
// Structure (top to bottom):
//   1. Module header (icon + "צי רכב")
//   2. דשבורד (dashboard link)
//   3. כרטיס נהג + כרטיס רכב (2 prominent CTA buttons)
//   4. 9 sub-module items with permission filtering
//   5. Toggle button in footer to collapse/expand
//
// Expanded by default. Collapsible to icons via footer toggle or SidebarRail.
// All links use Next.js <Link> for instant client-side navigation.

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  UserCheck,
  Car,
  Fuel,
  SquareActivity,
  Receipt,
  Zap,
  MapPin,
  KeyRound,
  ClipboardList,
  AlertTriangle,
  BarChart2,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Sub-module Config ────────────────────────────────────────────────────────

type FleetSubModule = {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
};

const FLEET_SUB_MODULES: FleetSubModule[] = [
  { key: "app_fleet_fuel", label: "דלק", href: "/app/fleet/fuel", icon: Fuel },
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
    label: "מעקב עמדות טעינה",
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
  permissions: string[];
  children: React.ReactNode;
};

// ─── Toggle Button (needs useSidebar context) ─────────────────────────────────

function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  // In RTL: ChevronsLeft opens (expands toward left), ChevronsRight closes (collapses toward right)
  const Icon = state === "expanded" ? ChevronsRight : ChevronsLeft;

  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center w-full h-8 rounded-md
                 text-sidebar-foreground/60 hover:text-sidebar-foreground
                 hover:bg-sidebar-accent transition-colors duration-200"
      title={state === "expanded" ? "כווץ תפריט" : "הרחב תפריט"}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FleetSidebar({ permissions, children }: FleetSidebarProps) {
  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const pathname = usePathname();

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ minHeight: 0 }}
      className="flex-1"
    >
      <Sidebar
        side="right"
        collapsible="icon"
        style={{
          top: "var(--header-h, 3.5rem)",
          height: "calc(100svh - var(--header-h, 3.5rem))",
        }}
      >
        {/* ── Module Header ────────────────────────────────────── */}
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
              <Car className="w-4 h-4 text-sidebar-primary" />
            </div>
            <span className="font-bold text-sm text-sidebar-foreground tracking-wide truncate">
              צי רכב
            </span>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {/* ── Dashboard + CTAs ─────────────────────────────── */}
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={{ children: "דשבורד", side: "left" as const }}
                  isActive={pathname === "/app/fleet"}
                  size="lg"
                  className="font-semibold"
                >
                  <Link href="/app/fleet">
                    <LayoutDashboard />
                    <span>דשבורד</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={{
                    children: "כרטיס נהג",
                    side: "left" as const,
                  }}
                  isActive={pathname.startsWith("/app/fleet/driver-card")}
                  size="lg"
                  className="font-semibold"
                >
                  <Link href="/app/fleet/driver-card">
                    <UserCheck />
                    <span>כרטיס נהג</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={{
                    children: "כרטיס רכב",
                    side: "left" as const,
                  }}
                  isActive={pathname.startsWith("/app/fleet/vehicle-card")}
                  size="lg"
                  className="font-semibold"
                >
                  <Link href="/app/fleet/vehicle-card">
                    <Car />
                    <span>כרטיס רכב</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator />

          {/* ── Sub-modules (9 items) ──────────────────────────── */}
          <SidebarGroup>
            <SidebarGroupLabel>מודולים</SidebarGroupLabel>
            <SidebarMenu>
              {FLEET_SUB_MODULES.map((item) => {
                const isEnabled = permSet.has(item.key);
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                if (isEnabled) {
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        tooltip={{
                          children: item.label,
                          side: "left" as const,
                        }}
                        isActive={isActive}
                        size="lg"
                        className="font-semibold transition-colors duration-200"
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={{
                        children: `${item.label} — אין גישה`,
                        side: "left" as const,
                      }}
                      size="lg"
                      className="opacity-40 cursor-not-allowed font-semibold"
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

        {/* ── Footer — visible toggle button ───────────────────── */}
        <SidebarFooter className="p-2">
          <SidebarToggle />
        </SidebarFooter>

        {/* Rail — invisible edge handle (secondary toggle method) */}
        <SidebarRail />
      </Sidebar>

      {/* ── Content area — white background (dark mode ready via bg-background) */}
      <div className="flex-1 overflow-auto bg-background rounded-tr-xl">
        {/* Mobile sidebar trigger — visible only on small screens */}
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 py-2 md:hidden">
          <SidebarTrigger className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            צי רכב
          </span>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </SidebarProvider>
  );
}
