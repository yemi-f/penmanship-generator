import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/cards");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Penmanship</h1>
      <p className="max-w-md text-muted-foreground">
        Personalized greeting cards and postcards, written in a real
        person&apos;s handwriting.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/cards" });
        }}
      >
        <Button type="submit" size="lg">
          Sign in with Google
        </Button>
      </form>
    </main>
  );
}
