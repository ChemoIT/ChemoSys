// Fleet home page — dashboard placeholder.
// CTAs (כרטיס נהג, כרטיס רכב) live in the sidebar now.
// This page shows the dashboard content area.

import { LayoutDashboard } from "lucide-react";

export default function FleetHomePage() {
  return (
    <div className="space-y-6">
      {/* Dashboard placeholder */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-6 h-6 text-brand-primary" />
        <h1 className="text-2xl font-bold text-foreground">דשבורד צי רכב</h1>
      </div>

      <div className="rounded-2xl border border-border/50 bg-brand-card p-8 shadow-sm">
        <p className="text-muted-foreground text-sm leading-relaxed">
          הדשבורד ייבנה בהמשך — כאן יוצגו נתוני סטטוס, התראות, וסיכומים.
        </p>
        <div className="mt-4 text-xs text-muted-foreground/60">בקרוב...</div>
      </div>
    </div>
  );
}
