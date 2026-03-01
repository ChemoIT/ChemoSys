"use client";

// LogoutButton — calls the logout Server Action via a form.
// Must be a client component so it can be used inside a server Sidebar
// without making the Sidebar itself a client component.

import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>התנתקות</span>
      </Button>
    </form>
  );
}
