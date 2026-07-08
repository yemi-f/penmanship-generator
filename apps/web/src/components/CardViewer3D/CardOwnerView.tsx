"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    return <p className="p-8 text-sm text-destructive">{error}</p>;
  }
  if (!card) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/share/${card.share_token}` : "";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Your card</h1>

      {!isComplete && (
        <p className="text-sm text-muted-foreground">
          {card.status === "pending" ? "Still generating…" : "Generation failed."}
        </p>
      )}

      {isComplete && designTextureUrl && writingTextureUrl && (
        <>
          {card.card_type === "postcard" ? (
            <PostcardViewer frontTextureUrl={designTextureUrl} backTextureUrl={writingTextureUrl} />
          ) : (
            <GreetingCardViewer
              orientation={card.orientation}
              designTextureUrl={designTextureUrl}
              writingTextureUrl={writingTextureUrl}
            />
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {card.writing_face_url && (
          <Button
            nativeButton={false}
            render={
              <a href={card.writing_face_url} download="writing-face.png">
                Download handwriting
              </a>
            }
          />
        )}
        {card.design_url && (
          <Button
            nativeButton={false}
            render={
              <a href={card.design_url} download="design.png">
                Download design
              </a>
            }
          />
        )}
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(shareLink)}>
          Copy share link
        </Button>
        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" variant="destructive">Delete</Button>} />
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
