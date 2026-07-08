"use client";

import Link from "next/link";

import type { ShareData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PostcardViewer } from "@/components/CardViewer3D/PostcardViewer";
import { GreetingCardViewer } from "@/components/CardViewer3D/GreetingCardViewer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Props = { shareToken: string; data: ShareData };

export function CardRecipientView({ shareToken, data }: Props) {
  // Public endpoints — no auth needed, so unlike the owner view these can be
  // passed directly to the texture loader without the blob-fetch dance.
  const designTextureUrl = `${API_BASE}/api/share/${shareToken}/textures/design`;
  const writingTextureUrl = `${API_BASE}/api/share/${shareToken}/textures/writing`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">You&apos;ve got a card!</h1>

      {data.design_url && data.writing_face_url ? (
        data.card_type === "postcard" ? (
          <PostcardViewer frontTextureUrl={designTextureUrl} backTextureUrl={writingTextureUrl} />
        ) : (
          <GreetingCardViewer
            orientation={data.orientation}
            designTextureUrl={designTextureUrl}
            writingTextureUrl={writingTextureUrl}
          />
        )
      ) : (
        <p className="text-sm text-muted-foreground">This card is still being prepared.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {data.writing_face_url && (
          <Button
            nativeButton={false}
            render={
              <a href={data.writing_face_url} download="writing-face.png">
                Download handwriting
              </a>
            }
          />
        )}
        {data.design_url && (
          <Button
            nativeButton={false}
            render={
              <a href={data.design_url} download="design.png">
                Download design
              </a>
            }
          />
        )}
        <Button nativeButton={false} variant="outline" render={<Link href="/">Make your own</Link>} />
      </div>
    </main>
  );
}
