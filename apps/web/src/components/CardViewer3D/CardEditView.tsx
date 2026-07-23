"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { parseSSE } from "@/lib/sse";
import type { CardMeta, CardUpdateRequest, CardUpdateResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StepDesign } from "@/components/CreateFlow/StepDesign";
import { StepMessage } from "@/components/CreateFlow/StepMessage";

type Phase = "loading" | "editing" | "generating" | "storing" | "error";

type Props = { cardId: string };

export function CardEditView({ cardId }: Props) {
  const router = useRouter();
  const [card, setCard] = useState<CardMeta | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [pct, setPct] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [designDescription, setDesignDescription] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [signOff, setSignOff] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await apiFetch(`/api/cards/${cardId}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const meta = (await res.json()) as CardMeta;
        if (cancelled) return;
        setCard(meta);
        setDesignDescription(meta.design_description);
        setMessage(meta.message);
        setRecipientName(meta.recipient_name ?? "");
        setSignOff(meta.sign_off ?? "");
        setPhase("editing");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  async function handleSave() {
    if (!card) return;
    setPhase("generating");
    setPct(0);
    try {
      const body: CardUpdateRequest = {
        design_description: designDescription,
        message,
        recipient_name: card.card_type === "postcard" ? recipientName : null,
        sign_off: signOff || null,
      };
      const patchRes = await apiFetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!patchRes.ok) {
        const errBody = await patchRes.json().catch(() => ({}));
        throw new Error(errBody.detail ? JSON.stringify(errBody.detail) : `Update failed (${patchRes.status})`);
      }
      const { regenerate_design, regenerate_writing } = (await patchRes.json()) as CardUpdateResponse;

      const streamRes = await apiFetch(
        `/api/cards/${cardId}/update-stream?regenerate_design=${regenerate_design}&regenerate_writing=${regenerate_writing}`,
      );
      if (!streamRes.ok) throw new Error(`Stream failed (${streamRes.status})`);

      for await (const evt of parseSSE(streamRes)) {
        const data = JSON.parse(evt.data);
        if (evt.event === "status") {
          setPhase(data.step);
          setPct(data.pct);
        } else if (evt.event === "complete") {
          router.replace(`/card/${cardId}`);
          return;
        } else if (evt.event === "error") {
          setErrorMessage(data.message);
          setPhase("error");
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-destructive">{errorMessage}</p>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/card/${cardId}`}>Back</Link>}
        />
      </main>
    );
  }

  if (phase === "generating" || phase === "storing") {
    return (
      <main className="mx-auto flex h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
        <h1 className="text-lg font-semibold">Updating your card</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {phase === "generating" ? "Regenerating…" : "Saving…"}
        </p>
        <Progress value={pct} />
      </main>
    );
  }

  if (!card) return null;

  const canSave = designDescription.trim().length > 0 && message.trim().length > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Edit card</h1>
      <StepDesign designDescription={designDescription} onChange={setDesignDescription} />
      <StepMessage
        cardType={card.card_type}
        message={message}
        onChange={setMessage}
        recipientName={recipientName}
        onRecipientNameChange={setRecipientName}
        signOff={signOff}
        onSignOffChange={setSignOff}
      />
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/card/${cardId}`}>Cancel</Link>}
        />
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          Save &amp; Regenerate
        </Button>
      </div>
    </main>
  );
}
