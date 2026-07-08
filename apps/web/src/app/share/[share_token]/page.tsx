import { CardRecipientView } from "@/components/CardViewer3D/CardRecipientView";
import type { ShareData } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function SharePage({ params }: { params: Promise<{ share_token: string }> }) {
  const { share_token } = await params;
  const res = await fetch(`${API_BASE}/api/share/${share_token}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">Card not found</h1>
        <p className="text-sm text-muted-foreground">
          This share link may have expired, or the card was deleted.
        </p>
      </main>
    );
  }

  const data = (await res.json()) as ShareData;
  return <CardRecipientView shareToken={share_token} data={data} />;
}
