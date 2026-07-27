import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { DashboardTabs } from "@/components/Dashboard/DashboardTabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button nativeButton={false} render={<Link href="/create">Create a card</Link>} />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      <DashboardTabs />
      {children}
    </main>
  );
}
