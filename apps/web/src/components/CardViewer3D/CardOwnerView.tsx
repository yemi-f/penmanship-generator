"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Book, BookOpen, FlipHorizontal2, Image as ImageIcon, Link2, PenLine, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useBlobTextureUrl } from "@/lib/useBlobTextureUrl";
import type { CardMeta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PostcardViewer } from "@/components/CardViewer3D/PostcardViewer";
import { GreetingCardViewer } from "@/components/CardViewer3D/GreetingCardViewer";

type Props = { cardId: string };

export function CardOwnerView({ cardId }: Props) {
  const router = useRouter();
  const [card, setCard] = useState<CardMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggled, setToggled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setCard((await res.json()) as CardMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [cardId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; setState only ever fires after the internal await
    refresh();
  }, [refresh]);

  const isComplete = card?.status === "complete";
  const designTextureUrl = useBlobTextureUrl(isComplete ? `/api/cards/${cardId}/textures/design` : null);
  const writingTextureUrl = useBlobTextureUrl(isComplete ? `/api/cards/${cardId}/textures/writing` : null);

  async function handleDelete() {
    const res = await apiFetch(`/api/cards/${cardId}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  if (error) {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-muted p-8 text-sm text-destructive">
        {error}
      </main>
    );
  }
  if (!card) {
    return (
      <main className="flex h-dvh w-dvw items-center justify-center bg-muted p-8 text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/share/${card.share_token}` : "";
  const ready = Boolean(isComplete && designTextureUrl && writingTextureUrl);

  const toggleLabel = card.card_type === "postcard" ? "Flip" : toggled ? "Close" : "Open";
  const ToggleIcon = card.card_type === "postcard" ? FlipHorizontal2 : toggled ? Book : BookOpen;

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-muted">
      {!isComplete && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">
          {card.status === "pending" ? "Still generating…" : "Generation failed."}
        </p>
      )}

      {isComplete && designTextureUrl && writingTextureUrl && (
        card.card_type === "postcard" ? (
          <PostcardViewer frontTextureUrl={designTextureUrl} backTextureUrl={writingTextureUrl} flipped={toggled} />
        ) : (
          <GreetingCardViewer
            orientation={card.orientation}
            designTextureUrl={designTextureUrl}
            writingTextureUrl={writingTextureUrl}
            isOpen={toggled}
          />
        )
      )}

      <div className="fixed bottom-6 left-1/2 z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur">
        {ready && (
          <Button size="sm" type="button" variant="ghost" className="rounded-full" onClick={() => setToggled((t) => !t)}>
            <ToggleIcon data-icon="inline-start" />
            {toggleLabel}
          </Button>
        )}
        {card.writing_face_url && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            nativeButton={false}
            render={
              <a href={card.writing_face_url} download="writing-face.png">
                <PenLine data-icon="inline-start" />
                Download handwriting
              </a>
            }
          />
        )}
        {card.design_url && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            nativeButton={false}
            render={
              <a href={card.design_url} download="design.png">
                <ImageIcon data-icon="inline-start" />
                Download design
              </a>
            }
          />
        )}
        <Button
          size="sm"
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigator.clipboard.writeText(shareLink)}
        >
          <Link2 data-icon="inline-start" />
          Copy share link
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button size="sm" type="button" variant="destructive" className="rounded-full">
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this card?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the card and its images. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
