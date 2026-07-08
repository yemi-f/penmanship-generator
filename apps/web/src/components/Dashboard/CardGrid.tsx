"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";
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

const PAGE_SIZE = 20;

export function CardGrid() {
  const [cards, setCards] = useState<CardMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (newOffset: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/cards?limit=${PAGE_SIZE}&offset=${newOffset}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as { cards: CardMeta[]; total: number };
      setCards(data.cards);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; setState only ever fires after the internal await
    refresh(0);
  }, [refresh]);

  async function handleDelete(cardId: string) {
    const res = await apiFetch(`/api/cards/${cardId}`, { method: "DELETE" });
    if (res.ok) refresh(offset);
  }

  function handleCopyLink(shareToken: string) {
    navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
  }

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">My Cards</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards yet — create one to get started.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {cards.map((card) => (
            <div key={card.card_id} className="flex flex-col gap-2 rounded-md border p-2">
              <Link href={`/card/${card.card_id}`}>
                {card.status === "complete" && card.design_url ? (
                  <img src={card.design_url} alt="" className="aspect-[3/2] w-full rounded object-cover" />
                ) : (
                  <div className="flex aspect-[3/2] w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    {card.status === "pending" ? "Generating…" : "Failed"}
                  </div>
                )}
              </Link>
              <p className="text-xs text-muted-foreground">
                {card.card_type === "postcard" ? "Postcard" : "Greeting Card"} ·{" "}
                {new Date(card.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => handleCopyLink(card.share_token)}>
                  Copy link
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button type="button" size="sm" variant="destructive">
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
                      <AlertDialogAction onClick={() => handleDelete(card.card_id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={!hasPrev} onClick={() => refresh(offset - PAGE_SIZE)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {total === 0 ? "0" : `${offset + 1}-${Math.min(offset + PAGE_SIZE, total)}`} of {total}
          </span>
          <Button type="button" variant="outline" disabled={!hasNext} onClick={() => refresh(offset + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
