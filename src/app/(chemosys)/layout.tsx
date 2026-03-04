// ChemoSys route group layout — dark full-screen, RTL.
// Visually distinct from admin (auth) layout: dark bg (#1B3A4B) vs light (#F5F7FA).
// Used only by /chemosys login page.
// Phase 8 creates (app)/layout.tsx separately for authenticated app pages.

export default function ChemosysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg relative overflow-hidden">
      {/* Subtle radial glow — adds depth to the dark background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(78,205,196,0.08) 0%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
