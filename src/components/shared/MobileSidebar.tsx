"use client";

// MobileSidebar — hamburger + slide-in drawer for mobile viewports (< lg).
// Uses shadcn/ui Sheet component. Opens from the right side (RTL).
// Closes automatically when a navigation link is clicked.

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";
import { LogoutButton } from "./LogoutButton";
import Image from "next/image";
import type { SessionUser } from "@/lib/dal";

type MobileSidebarProps = {
  user: SessionUser;
};

export function MobileSidebar({ user }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="p-2 rounded-md text-sidebar-text hover:bg-sidebar-hover transition-colors"
          aria-label="פתח תפריט"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      {/* side="right" opens from the right — correct for RTL */}
      <SheetContent
        side="right"
        className="w-64 p-0 bg-sidebar-bg text-sidebar-text border-e-0"
      >
        {/* Accessible title (visually hidden by shadcn/ui defaults) */}
        <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>

        {/* Brand header — mirrors desktop Sidebar */}
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

        {/* Close drawer on nav click by wrapping in a div with onClick */}
        <div onClick={() => setOpen(false)} className="flex-1">
          <SidebarNav />
        </div>

        {/* User footer */}
        <div className="border-t border-white/10 px-4 py-4 space-y-2">
          <p className="text-xs text-sidebar-text/60 truncate" title={user.email}>
            {user.email}
          </p>
          <LogoutButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
