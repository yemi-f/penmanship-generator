"use client";

import { dashboardCache } from "@/lib/dashboardCache";
import { signOutAction } from "@/lib/authActions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        // Clear before navigating away so a different account signing in next
        // (or this account re-signing in) never renders a previous session's
        // cached cards/samples.
        dashboardCache.invalidateCards();
        dashboardCache.invalidateSamples();
        void signOutAction();
      }}
    >
      Sign out
    </Button>
  );
}
