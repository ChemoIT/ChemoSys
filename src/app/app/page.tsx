// Module selection page — post-login landing for ChemoSys users with 2+ modules.
// Server component: reads permissions server-side, no client bundle bloat.
//
// Flow:
//   1. verifyAppUser() — redirects to /chemosys if unauthenticated / blocked / no app_* perms
//   2. getAppNavPermissions() — returns array of app_* keys the user holds
//   3. Auto-redirect if only one top-level module accessible (UX: skip the selection screen)
//   4. Show two module cards (always both visible; disabled = grayed + "אין גישה")
//
// Wrapped by (app)/layout.tsx which provides auth guard, header, and dark background.
// The standalone placement at src/app/app/page.tsx is intentional —
// Next.js App Router applies the (app) route group layout without moving this file.

import { verifyAppUser, getAppNavPermissions } from "@/lib/dal";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Truck, HardHat, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ── ModuleButton ──────────────────────────────────────────────────────────────
// Inline helper — not exported, not a separate file.
// Active:   Link tile — teal border, teal icon, hover bg tint
// Disabled: div tile — gray border, muted icon, "אין גישה" badge, no pointer events
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleButtonProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
}

function ModuleButton({ href, label, icon, enabled }: ModuleButtonProps) {
  const base = [
    "flex flex-col items-center justify-center gap-4",
    "p-8 rounded-2xl border-2 transition-all duration-200",
    "text-center select-none",
  ].join(" ");

  const activeStyles = [
    "border-brand-primary text-brand-primary",
    "hover:bg-brand-primary/10 hover:shadow-lg hover:scale-[1.03]",
    "cursor-pointer",
  ].join(" ");

  const disabledStyles = [
    "border-border text-muted-foreground",
    "opacity-50 cursor-not-allowed",
  ].join(" ");

  if (enabled) {
    return (
      <Link href={href} className={cn(base, activeStyles)}>
        {/* Icon container — large enough for field-worker touch targets */}
        <span className="w-14 h-14 flex items-center justify-center rounded-xl bg-brand-primary/15">
          {icon}
        </span>
        <span className="font-bold text-base tracking-wide">{label}</span>
      </Link>
    );
  }

  return (
    <div
      className={cn(base, disabledStyles)}
      aria-disabled="true"
      role="img"
      aria-label={`${label} — אין גישה`}
    >
      <span className="w-14 h-14 flex items-center justify-center rounded-xl bg-muted">
        {icon}
      </span>
      <span className="font-bold text-base tracking-wide">{label}</span>
      {/* "No access" badge */}
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/80 rounded-full px-3 py-1">
        <ShieldOff className="w-3 h-3" />
        אין גישה
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AppHomePage() {
  // Auth guard — redirects to /chemosys on failure (unauthenticated, blocked, no app_* perms)
  await verifyAppUser();

  // Read the user's top-level app module permissions
  const permissions = await getAppNavPermissions();

  const hasFleet = permissions.includes("app_fleet");
  const hasEquipment = permissions.includes("app_equipment");

  // Auto-redirect: if only one top-level module is accessible, skip the selection screen
  if (hasFleet && !hasEquipment) redirect("/app/fleet");
  if (hasEquipment && !hasFleet) redirect("/app/equipment");

  // Edge case: verifyAppUser passed but neither top-level module is in the list.
  // This means the user only has sub-module permissions (e.g. app_fleet_vehicles)
  // without the parent module key — send them to fleet as the safer default.
  if (!hasFleet && !hasEquipment) redirect("/chemosys");

  // Both modules accessible → show the selection screen.
  // (app)/layout.tsx provides the dark background and header — this page
  // only needs to center its card within the layout's <main>.
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {/* Selection card */}
      <div className="bg-brand-card rounded-2xl shadow-2xl p-10 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            בחר מודול
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            בחר את המודול שברצונך לפתוח
          </p>
        </div>

        {/* Module buttons — 2-column grid */}
        <div className="grid grid-cols-2 gap-4">
          <ModuleButton
            href="/app/fleet"
            label='צי רכב'
            icon={<Truck className="w-7 h-7" strokeWidth={1.5} />}
            enabled={hasFleet}
          />
          <ModuleButton
            href="/app/equipment"
            label='צמ"ה'
            icon={<HardHat className="w-7 h-7" strokeWidth={1.5} />}
            enabled={hasEquipment}
          />
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          למעבר למודול אחר — פנה לאחראי המערכת
        </p>
      </div>
    </div>
  );
}
