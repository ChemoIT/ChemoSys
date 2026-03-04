"use client";

// ChemoSys login page — client component for useActionState (React 19).
// Dark-themed, visually distinct from admin login (/login).
// Email + password + module selection form with "remember me" persisting to localStorage.
// "Remember me" key: chemosys_app_remember (separate from admin's chemosys_remember).
// On success: loginApp() checks module permission and redirects to /app/{module}.

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { loginApp } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, HardHat } from "lucide-react";

const REMEMBER_KEY = "chemosys_app_remember";

type ModuleOption = "fleet" | "equipment";

const MODULES: { key: ModuleOption; label: string; icon: typeof Truck }[] = [
  { key: "fleet", label: "צי רכב", icon: Truck },
  { key: "equipment", label: 'צמ"ה', icon: HardHat },
];

export default function ChemosysLoginPage() {
  const [state, formAction, isPending] = useActionState(loginApp, null);
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleOption>("fleet");

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        const { e, p } = JSON.parse(atob(stored));
        if (e) setSavedEmail(e);
        if (p) setSavedPassword(p);
        setRemember(true);
      }
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  // Save or clear credentials before submitting
  function handleSubmit(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (remember && email) {
      localStorage.setItem(
        REMEMBER_KEY,
        btoa(JSON.stringify({ e: email, p: password }))
      );
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    formAction(formData);
  }

  return (
    <div className="relative w-full max-w-md px-4">
      {/* Card */}
      <div className="bg-brand-card rounded-2xl shadow-2xl px-8 py-7 w-full">

        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-5 gap-2">
          <Image
            src="/logo-he.png"
            alt="חמו אהרון"
            width={180}
            height={60}
            priority
            className="object-contain"
          />
          {/* Divider with label */}
          <div className="flex items-center gap-3 w-full mt-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              מערכת ניהול לוגיסטי
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-center text-lg font-bold text-foreground mb-4">
          CHEMO SYSTEM
        </h1>

        {/* Login Form */}
        <form action={handleSubmit} className="space-y-3.5">

          {/* Email field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              כתובת מייל
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              autoComplete="email"
              disabled={isPending}
              defaultValue={savedEmail}
              className="h-9 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-brand-primary"
            />
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">
              סיסמה
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="הזינו סיסמה"
              required
              autoComplete="current-password"
              disabled={isPending}
              defaultValue={savedPassword}
              className="h-9 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-brand-primary"
            />
          </div>

          {/* Module selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">בחר מודול</Label>
            <input type="hidden" name="module" value={selectedModule} />
            <div className="grid grid-cols-2 gap-2.5">
              {MODULES.map(({ key, label, icon: Icon }) => {
                const isSelected = selectedModule === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelectedModule(key)}
                    className={[
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2",
                      "transition-all duration-200 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
                      isSelected
                        ? "border-brand-primary bg-brand-primary/10 shadow-md shadow-brand-primary/10"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/50",
                      isPending ? "opacity-60 pointer-events-none" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-brand-primary/20 text-brand-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      <Icon className="w-5.5 h-5.5" strokeWidth={1.8} />
                    </span>
                    <span
                      className={[
                        "text-sm font-semibold transition-colors",
                        isSelected ? "text-brand-primary" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
              className="border-muted-foreground data-[state=checked]:bg-brand-primary data-[state=checked]:border-brand-primary"
            />
            <Label
              htmlFor="remember"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              זכור אותי
            </Label>
          </div>

          {/* Hebrew error message */}
          {state?.error && (
            <div
              role="alert"
              className="rounded-lg bg-brand-danger/10 border border-brand-danger/30 px-4 py-3"
            >
              <p className="text-sm text-brand-danger font-medium">
                {state.error}
              </p>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full h-10 text-sm font-semibold bg-brand-primary hover:bg-brand-primary/90 text-white transition-all duration-150 active:scale-[0.98]"
            disabled={isPending}
          >
            {isPending ? "מתחבר..." : "כניסה למערכת"}
          </Button>
        </form>

      </div>
    </div>
  );
}
