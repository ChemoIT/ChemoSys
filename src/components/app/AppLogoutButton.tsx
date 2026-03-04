"use client";

// AppLogoutButton — calls the logoutApp Server Action via a form.
// Mirrors LogoutButton.tsx but redirects to /chemosys (ChemoSys login)
// instead of /login (admin login). ChemoSys users must not be redirected
// to the admin login page on sign-out.

import { logoutApp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLogoutButton() {
  return (
    <form action={logoutApp}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="gap-2 text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>התנתקות</span>
      </Button>
    </form>
  );
}
