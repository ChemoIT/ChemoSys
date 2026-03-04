// AppHeader — sticky top header for the ChemoSys (app) shell.
// Server component — no client JS. Receives displayName and permissions
// from (app)/layout.tsx which resolves them server-side.
//
// Layout (RTL):
//   Right side (start): CA logo + "CHEMO SYSTEM" brand text
//   Left side  (end):   user display name + ModuleSwitcher + logout button
//
// ModuleSwitcher is a client component — rendered here inside a server component
// by passing only serializable props (permissions string[]).

import Image from "next/image";
import { ModuleSwitcher } from "@/components/app/ModuleSwitcher";
import { AppLogoutButton } from "@/components/app/AppLogoutButton";

type AppHeaderProps = {
  displayName: string;
  permissions: string[];
};

export function AppHeader({ displayName, permissions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-sidebar-bg border-b border-white/10 px-4 py-3">
      {/* Brand section — right side in RTL (logical start) */}
      <div className="flex items-center gap-3">
        <Image
          src="/logo-icon.png"
          width={32}
          height={32}
          alt="CA"
          className="rounded-sm"
          priority
        />
        {/* Brand name — hidden on very small screens to save space */}
        <span className="text-sidebar-text font-bold text-sm hidden sm:block tracking-wide">
          CHEMO SYSTEM
        </span>
      </div>

      {/* Controls section — left side in RTL (logical end) */}
      <div className="flex items-center gap-2">
        {/* User display name — hidden on small screens */}
        <span className="text-sidebar-text/80 text-sm hidden sm:block">
          {displayName}
        </span>

        {/* Module switcher — only rendered when user has 2+ top-level modules */}
        <ModuleSwitcher permissions={permissions} />

        {/* Logout button — redirects to /chemosys */}
        <AppLogoutButton />
      </div>
    </header>
  );
}
