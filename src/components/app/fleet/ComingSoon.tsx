// ComingSoon — reusable placeholder for fleet sub-module pages.
// Used by all 9 sub-module pages until their real content is built.
//
// Props:
//   label — Hebrew module name (e.g. "דלק", "טפסים")
//   icon  — optional Lucide icon component, rendered large in brand-primary color
//
// Design: modern 2026 feel — rounded-2xl card, shadow-lg, pulsing icon,
// hover scale + shadow transition, brand-primary color tokens from globals.css.

import type { LucideProps } from "lucide-react";

type ComingSoonProps = {
  label: string;
  icon?: React.ComponentType<LucideProps>;
};

export function ComingSoon({ label, icon: Icon }: ComingSoonProps) {
  return (
    // Full-area centering — fills the FleetLayout content div
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <div
        className="
          bg-brand-card rounded-2xl shadow-lg border border-border/50 p-10
          flex flex-col items-center gap-4 text-center max-w-xs
          transition-all duration-300 hover:shadow-xl hover:scale-[1.01]
        "
      >
        {/* Icon — large, brand-primary color, subtle pulse animation */}
        {Icon && (
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-brand-primary animate-pulse" />
          </div>
        )}

        {/* Module label */}
        <h2 className="text-xl font-bold text-foreground">{label}</h2>

        {/* Coming soon message */}
        <p className="text-sm text-muted-foreground">בקרוב...</p>
      </div>
    </div>
  );
}
