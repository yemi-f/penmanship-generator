import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CardEditView } from "@/components/CardViewer3D/CardEditView";

export const metadata: Metadata = { title: "Edit Card" };

export default async function CardEditPage({ params }: { params: Promise<{ card_id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const { card_id } = await params;
  return <CardEditView cardId={card_id} />;
}
