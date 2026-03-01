// Sidebar — server component for the desktop admin sidebar.
// Renders the brand header, navigation (via SidebarNav client component),
// and the user footer with logout.
// Positioned on the RIGHT side (RTL: fixed start-0 = fixed right-0 in RTL layout).
//
// Uses sidebar-bg CSS variable — dark navy (#1B3A4B) from globals.css.

import Image from "next/image";
import { SidebarNav } from "./SidebarNav";
import { LogoutButton } from "./LogoutButton";
import type { SessionUser } from "@/lib/dal";

type SidebarProps = {
  user: SessionUser;
};

export function Sidebar({ user }: SidebarProps) {
  return (
    // sidebar-bg class uses --color-sidebar-bg from globals.css
    <div className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-text">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Image
          src="/logo-icon.png"
          alt="CA"
          width={36}
          height={36}
          className="shrink-0 rounded"
        />
        <span className="text-lg font-bold text-sidebar-text tracking-tight">
          ChemoSys
        </span>
      </div>

      {/* Navigation — client component for usePathname() active state */}
      <SidebarNav />

      {/* User footer: email + logout */}
      <div className="border-t border-white/10 px-4 py-4 space-y-2">
        <p className="text-xs text-sidebar-text/60 truncate" title={user.email}>
          {user.email}
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
