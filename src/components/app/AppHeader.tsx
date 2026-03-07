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
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4"
      style={{
        background: "linear-gradient(135deg, #152D3C 0%, #1A3D52 60%, #163444 100%)",
        borderBottom: "1px solid rgb(255 255 255 / 0.07)",
        boxShadow: "0 2px 12px rgb(21 45 60 / 0.30)",
        minHeight: "52px",
      }}
    >
      {/* Brand section — right side in RTL */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Image
            src="/logo-icon.png"
            width={32}
            height={32}
            alt="CA"
            className="rounded-md"
            priority
          />
          <div
            className="absolute inset-0 rounded-md pointer-events-none"
            style={{ boxShadow: "0 0 0 1px rgb(78 205 196 / 0.30)" }}
          />
        </div>
        <div className="hidden sm:flex flex-col leading-none gap-0.5">
          <span className="text-white font-bold text-[13px] tracking-[0.12em] uppercase">
            Chemo System
          </span>
          <span className="text-[9px] text-white/40 tracking-[0.20em] uppercase font-medium">
            ניהול לוגיסטי
          </span>
        </div>
      </div>

      {/* Controls section — left side in RTL */}
      <div className="flex items-center gap-1.5">
        {/* User display name chip */}
        {displayName && (
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: "rgb(255 255 255 / 0.06)",
              border: "1px solid rgb(255 255 255 / 0.10)",
            }}
          >
            <div className="h-5 w-5 rounded-full bg-primary/70 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white leading-none">
                {displayName.charAt(0)}
              </span>
            </div>
            <span className="text-white/70 text-sm font-medium">{displayName}</span>
          </div>
        )}

        {/* Module switcher */}
        <ModuleSwitcher permissions={permissions} />

        {/* Logout button */}
        <AppLogoutButton />
      </div>
    </header>
  );
}
