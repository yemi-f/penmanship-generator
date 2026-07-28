"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Book,
  BookOpen,
  Check,
  Copy,
  FlipHorizontal2,
  Image as ImageIcon,
  PenLine,
  SquarePen,
  Trash2,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { dashboardCache } from "@/lib/dashboardCache";
import { downloadBlob } from "@/lib/downloadFile";
import { useBlobTextureUrl } from "@/lib/useBlobTextureUrl";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
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
  const { copiedId, copy } = useCopyToClipboard();

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
    if (res.ok) {
      dashboardCache.invalidateCards();
      router.push("/cards");
    }
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
          <PostcardViewer
            frontTextureUrl={designTextureUrl}
            backTextureUrl={writingTextureUrl}
            flipped={toggled}
            onToggle={() => setToggled((t) => !t)}
          />
        ) : (
          <GreetingCardViewer
            orientation={card.orientation}
            designTextureUrl={designTextureUrl}
            writingTextureUrl={writingTextureUrl}
            isOpen={toggled}
            onToggle={() => setToggled((t) => !t)}
          />
        )
      )}

      <Link
        href="/"
        className="fixed top-6 left-6 z-20 inline-flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Home
      </Link>

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
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() =>
              downloadBlob(() => apiFetch(`/api/cards/${cardId}/textures/writing`), "writing-face.png")
            }
          >
            <PenLine data-icon="inline-start" />
            Download handwriting
          </Button>
        )}
        {card.design_url && (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => downloadBlob(() => apiFetch(`/api/cards/${cardId}/textures/design`), "design.png")}
          >
            <ImageIcon data-icon="inline-start" />
            Download design
          </Button>
        )}
        <Button
          size="sm"
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => copy(cardId, shareLink)}
        >
          {copiedId === cardId ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copiedId === cardId ? "Copied!" : "Copy share link"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={
            <Link href={`/card/${cardId}/edit`}>
              <SquarePen data-icon="inline-start" />
              Edit
            </Link>
          }
        />
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
