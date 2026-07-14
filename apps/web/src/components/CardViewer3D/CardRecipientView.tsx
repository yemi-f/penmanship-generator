"use client";

import { useState } from "react";
import Link from "next/link";

import type { ShareData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PostcardViewer } from "@/components/CardViewer3D/PostcardViewer";
import { GreetingCardViewer } from "@/components/CardViewer3D/GreetingCardViewer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Props = { shareToken: string; data: ShareData };

export function CardRecipientView({ shareToken, data }: Props) {
  const [toggled, setToggled] = useState(false);

  // Public endpoints — no auth needed, so unlike the owner view these can be
  // passed directly to the texture loader without the blob-fetch dance.
  const designTextureUrl = `${API_BASE}/api/share/${shareToken}/textures/design`;
  const writingTextureUrl = `${API_BASE}/api/share/${shareToken}/textures/writing`;
  const ready = Boolean(data.design_url && data.writing_face_url);

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 bg-muted p-8">
      <div className="sticky top-0 z-10 -mx-8 flex flex-wrap items-center justify-between gap-4 bg-muted px-6 py-2">
        <div>
          {ready && (
            <Button size="sm" type="button" variant="outline" onClick={() => setToggled((t) => !t)}>
              {data.card_type === "postcard" ? "Flip" : toggled ? "Close" : "Open"}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {data.writing_face_url && (
            <Button
              size="sm"
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
              size="sm"
              nativeButton={false}
              render={
                <a href={data.design_url} download="design.png">
                  Download design
                </a>
              }
            />
          )}
          <Button size="sm" nativeButton={false} variant="outline" render={<Link href="/">Make your own</Link>} />
        </div>
      </div>

      {ready ? (
        data.card_type === "postcard" ? (
          <PostcardViewer frontTextureUrl={designTextureUrl} backTextureUrl={writingTextureUrl} flipped={toggled} />
        ) : (
          <GreetingCardViewer
            orientation={data.orientation}
            designTextureUrl={designTextureUrl}
            writingTextureUrl={writingTextureUrl}
            isOpen={toggled}
          />
        )
      ) : (
        <p className="mx-auto w-full max-w-2xl text-sm text-muted-foreground">This card is still being prepared.</p>
      )}
    </main>
  );
}
