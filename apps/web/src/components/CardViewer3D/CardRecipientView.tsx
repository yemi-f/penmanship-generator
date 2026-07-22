"use client";

import { useState } from "react";
import Link from "next/link";
import { Book, BookOpen, FlipHorizontal2, Image as ImageIcon, PenLine, Sparkles } from "lucide-react";

import { downloadBlob } from "@/lib/downloadFile";
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

  const toggleLabel = data.card_type === "postcard" ? "Flip" : toggled ? "Close" : "Open";
  const ToggleIcon = data.card_type === "postcard" ? FlipHorizontal2 : toggled ? Book : BookOpen;

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-muted">
      {ready ? (
        data.card_type === "postcard" ? (
          <PostcardViewer
            frontTextureUrl={designTextureUrl}
            backTextureUrl={writingTextureUrl}
            flipped={toggled}
            onToggle={() => setToggled((t) => !t)}
          />
        ) : (
          <GreetingCardViewer
            orientation={data.orientation}
            designTextureUrl={designTextureUrl}
            writingTextureUrl={writingTextureUrl}
            isOpen={toggled}
            onToggle={() => setToggled((t) => !t)}
          />
        )
      ) : (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">
          This card is still being prepared.
        </p>
      )}

      <div className="fixed bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur">
        {ready && (
          <Button size="sm" type="button" variant="ghost" className="rounded-full" onClick={() => setToggled((t) => !t)}>
            <ToggleIcon data-icon="inline-start" />
            {toggleLabel}
          </Button>
        )}
        {data.writing_face_url && (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => downloadBlob(() => fetch(writingTextureUrl), "writing-face.png")}
          >
            <PenLine data-icon="inline-start" />
            Download handwriting
          </Button>
        )}
        {data.design_url && (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => downloadBlob(() => fetch(designTextureUrl), "design.png")}
          >
            <ImageIcon data-icon="inline-start" />
            Download design
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          nativeButton={false}
          render={
            <Link href="/">
              <Sparkles data-icon="inline-start" />
              Make your own
            </Link>
          }
        />
      </div>
    </main>
  );
}
