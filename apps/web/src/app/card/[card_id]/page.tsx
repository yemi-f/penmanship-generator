import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CardOwnerView } from "@/components/CardViewer3D/CardOwnerView";

export const metadata: Metadata = { title: "Card" };

export default async function CardPage({ params }: { params: Promise<{ card_id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const { card_id } = await params;
  return <CardOwnerView cardId={card_id} />;
}
