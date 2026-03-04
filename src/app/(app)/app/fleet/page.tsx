// Fleet home — placeholder until Phase 9 builds the full sub-module grid.
// Wrapped by (app)/layout.tsx which provides auth guard + AppHeader.

export default function FleetHomePage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-brand-card rounded-2xl shadow-2xl p-10 text-center max-w-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">צי רכב</h1>
        <p className="text-muted-foreground text-sm">
          דף הבית של מודול צי הרכב — ייבנה בשלב 9
        </p>
      </div>
    </div>
  );
}
