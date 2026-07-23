import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CardEditView } from "@/components/CardViewer3D/CardEditView";

export default async function CardEditPage({ params }: { params: Promise<{ card_id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const { card_id } = await params;
  return <CardEditView cardId={card_id} />;
}
