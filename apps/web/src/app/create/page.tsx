import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CreateFlow } from "@/components/CreateFlow/CreateFlow";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  return <CreateFlow />;
}
