"use client";

// Login page — client component for useActionState (React 19).
// Displays full Chemo Aharon Hebrew logo, email/password form,
// submits via login Server Action, shows Hebrew error messages.
// "Remember me" saves email to localStorage for next visit.

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const REMEMBER_KEY = "chemosys_remember_email";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);
  const [savedEmail, setSavedEmail] = useState("");
  const [remember, setRemember] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (stored) {
      setSavedEmail(stored);
      setRemember(true);
    }
  }, []);

  // Save or clear email on form submit
  function handleSubmit(formData: FormData) {
    const email = formData.get("email") as string;
    if (remember && email) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    formAction(formData);
  }

  return (
    <div className="bg-brand-card rounded-xl shadow-lg p-8 w-full max-w-md">
      {/* Chemo Aharon Hebrew Logo */}
      <div className="flex justify-center mb-8">
        <Image
          src="/logo-he.png"
          alt="חמו אהרון"
          width={280}
          height={100}
          priority
        />
      </div>

      {/* Login Form */}
      <form action={handleSubmit} className="space-y-5">
        {/* Email field */}
        <div className="space-y-2">
          <Label htmlFor="email">כתובת מייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your@email.com"
            required
            autoComplete="email"
            disabled={isPending}
            defaultValue={savedEmail}
          />
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="הזינו סיסמה"
            required
            autoComplete="current-password"
            disabled={isPending}
          />
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
          />
          <Label htmlFor="remember" className="text-sm cursor-pointer">
            זכור אותי
          </Label>
        </div>

        {/* Server-side error message */}
        {state?.error && (
          <p className="text-sm text-brand-danger" role="alert">
            {state.error}
          </p>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white"
          disabled={isPending}
        >
          {isPending ? "מתחבר..." : "התחברות"}
        </Button>
      </form>
    </div>
  );
}
