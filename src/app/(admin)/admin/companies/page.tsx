// Companies page — placeholder for Phase 1.
// Verifies auth works end-to-end with the admin shell.
// Full CRUD implementation comes in Plan 01-04.

import { verifySession } from "@/lib/dal";

export default async function CompaniesPage() {
  // Auth guard — redirects to /login if no valid session.
  await verifySession();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">ניהול חברות</h1>
      <p className="text-muted-foreground mt-2">
        דף זה ייבנה בשלב הבא
      </p>
    </div>
  );
}
