// Fleet home page — dashboard placeholder + 2 CTA buttons.
// Shown at /app/fleet (default child of FleetLayout).
//
// Structure:
//   1. Dashboard banner — "דשבורד צי רכב" with "בקרוב..." message
//   2. 2 CTA cards — כרטיס נהג + כרטיס רכב (placeholder, not yet clickable)
//
// Design: modern 2026 feel — rounded-2xl cards, shadow-lg, brand colors,
// group-hover transitions, airy spacing via space-y-8.

import { LayoutDashboard, UserCheck, Car } from "lucide-react";

export default function FleetHomePage() {
  return (
    <div className="space-y-8">
      {/* ── Dashboard placeholder banner ─────────────────────────────────── */}
      <section className="bg-brand-card rounded-2xl p-8 shadow-lg border border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <LayoutDashboard className="w-6 h-6 text-brand-primary" />
          <h2 className="text-xl font-bold text-foreground">דשבורד צי רכב</h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          הדשבורד ייבנה בהמשך — כאן יוצגו נתוני סטטוס, התראות, וסיכומים.
        </p>
        <div className="mt-4 text-xs text-muted-foreground/60">בקרוב...</div>
      </section>

      {/* ── CTA buttons section ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* כרטיס נהג */}
        <div
          className="
            group bg-brand-card rounded-2xl p-6 shadow-lg border border-border/50
            hover:shadow-xl hover:border-brand-primary/30
            transition-all duration-300 cursor-default
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center
                group-hover:bg-brand-primary/20 transition-colors duration-300
              "
            >
              <UserCheck className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">כרטיס נהג</h3>
              <p className="text-sm text-muted-foreground">בקרוב...</p>
            </div>
          </div>
        </div>

        {/* כרטיס רכב */}
        <div
          className="
            group bg-brand-card rounded-2xl p-6 shadow-lg border border-border/50
            hover:shadow-xl hover:border-brand-primary/30
            transition-all duration-300 cursor-default
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center
                group-hover:bg-brand-primary/20 transition-colors duration-300
              "
            >
              <Car className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">כרטיס רכב</h3>
              <p className="text-sm text-muted-foreground">בקרוב...</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
