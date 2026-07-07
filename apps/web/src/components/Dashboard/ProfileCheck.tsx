"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

export function ProfileCheck() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/me")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }
        setProfile(await res.json());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">Failed to reach API: {error}</p>;
  }
  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading profile from B2…</p>;
  }
  return (
    <pre className="rounded-md bg-muted p-4 text-sm">
      {JSON.stringify(profile, null, 2)}
    </pre>
  );
}
