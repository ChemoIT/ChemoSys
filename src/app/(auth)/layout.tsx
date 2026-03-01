// Auth layout — public, no authentication required.
// Centers content vertically and horizontally on a brand-background screen.
// Used by: /login (and any future public auth pages).

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      {children}
    </div>
  );
}
