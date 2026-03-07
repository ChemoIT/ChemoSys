"use client";

// FleetSidebar — collapsible RTL sidebar shell for the fleet module.
// Wraps BOTH the sidebar AND the content area in SidebarProvider (required by shadcn).

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
  { key: "app_fleet_tolls", label: "כבישי אגרה", href: "/app/fleet/tolls", icon: SquareActivity },
  { key: "app_fleet_invoices", label: "חשבוניות ספקים", href: "/app/fleet/invoices", icon: Receipt },
  { key: "app_fleet_ev_charging", label: "טעינת רכב חשמלי", href: "/app/fleet/ev-charging", icon: Zap },
  { key: "app_fleet_charging_stations", label: "מעקב עמדות טעינה", href: "/app/fleet/charging-stations", icon: MapPin },
  { key: "app_fleet_rentals", label: "הזמנת רכב שכור", href: "/app/fleet/rentals", icon: KeyRound },
  { key: "app_fleet_forms", label: "טפסים", href: "/app/fleet/forms", icon: ClipboardList },
  { key: "app_fleet_exceptions", label: "טבלת חריגים", href: "/app/fleet/exceptions", icon: AlertTriangle },
  { key: "app_fleet_reports", label: "דוחות", href: "/app/fleet/reports", icon: BarChart2 },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type FleetSidebarProps = {
  permissions: string[];
  children: React.ReactNode;
};

// ─── Toggle Button ─────────────────────────────────────────────────────────────

function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const Icon = state === "expanded" ? ChevronsRight : ChevronsLeft;

  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center w-full h-8 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
      title={state === "expanded" ? "כווץ תפריט" : "הרחב תפריט"}
    >
      <Icon className="w-3.5 h-3.5" />
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
          top: "var(--header-h, 3.25rem)",
          height: "calc(100svh - var(--header-h, 3.25rem))",
          background: "#152D3C",
          borderLeft: "1px solid rgb(255 255 255 / 0.07)",
        }}
      >
        {/* ── Module Header ────────────────────────────────────── */}
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgb(78 205 196 / 0.22) 0%, rgb(78 205 196 / 0.08) 100%)",
                border: "1px solid rgb(78 205 196 / 0.22)",
              }}
            >
              <Car className="w-4 h-4 text-primary" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <p className="font-bold text-[13px] text-sidebar-foreground tracking-wide truncate leading-tight">
                צי רכב
              </p>
              <p className="text-[9px] text-white/30 tracking-[0.18em] uppercase mt-0.5">
                Fleet Module
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator style={{ background: "rgb(255 255 255 / 0.06)", margin: 0 }} />

        <SidebarContent
          className="px-2 py-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgb(255 255 255 / 0.08) transparent" }}
        >
          {/* ── Main nav ─────────────────────────────────────── */}
          <SidebarGroup className="p-0 space-y-0.5">
            {[
              {
                href: "/app/fleet",
                label: "דשבורד",
                icon: LayoutDashboard,
                isActive: pathname === "/app/fleet",
              },
              {
                href: "/app/fleet/driver-card",
                label: "כרטיס נהג",
                icon: UserCheck,
                isActive: pathname.startsWith("/app/fleet/driver-card"),
              },
              {
                href: "/app/fleet/vehicle-card",
                label: "כרטיס רכב",
                icon: Car,
                isActive: pathname.startsWith("/app/fleet/vehicle-card"),
              },
            ].map(({ href, label, icon: Icon, isActive }) => (
              <SidebarMenuItem key={href} className="list-none">
                <SidebarMenuButton
                  asChild
                  tooltip={{ children: label, side: "left" as const }}
                  isActive={isActive}
                >
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all duration-150",
                      "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "text-primary"
                        : "text-white/55 hover:text-white/90 hover:bg-white/5"
                    )}
                    style={isActive ? {
                      background: "rgb(78 205 196 / 0.10)",
                      borderRight: "3px solid #4ECDC4",
                    } : {}}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroup>

          <SidebarSeparator
            className="my-3"
            style={{ background: "rgb(255 255 255 / 0.05)" }}
          />

          {/* ── Sub-modules ──────────────────────────────────── */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel
              className="px-3 mb-2 text-[10px] tracking-[0.18em] uppercase"
              style={{ color: "rgb(255 255 255 / 0.22)" }}
            >
              מודולים
            </SidebarGroupLabel>
            <div className="space-y-0.5">
              {FLEET_SUB_MODULES.map((item) => {
                const isEnabled = permSet.has(item.key);
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.key} className="list-none">
                    <SidebarMenuButton
                      asChild={isEnabled}
                      tooltip={{ children: item.label, side: "left" as const }}
                      isActive={isActive}
                    >
                      {isEnabled ? (
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "text-primary"
                              : "text-white/45 hover:text-white/80 hover:bg-white/5"
                          )}
                          style={isActive ? {
                            background: "rgb(78 205 196 / 0.08)",
                            borderRight: "2px solid #4ECDC4",
                          } : {}}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium opacity-25 cursor-not-allowed group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 text-white/40">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </div>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer ─────────────────────────────────────────── */}
        <SidebarFooter
          className="p-2"
          style={{ borderTop: "1px solid rgb(255 255 255 / 0.06)" }}
        >
          <SidebarToggle />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="flex-1 w-0 overflow-auto bg-background">
        {/* Mobile sidebar trigger */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-white/85 backdrop-blur-md border-b border-border px-4 py-2.5 md:hidden">
          <SidebarTrigger className="text-muted-foreground h-9 w-9" />
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">צי רכב</span>
          </div>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </SidebarProvider>
  );
}
