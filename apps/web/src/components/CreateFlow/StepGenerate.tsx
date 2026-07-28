"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { dashboardCache } from "@/lib/dashboardCache";
import { parseSSE } from "@/lib/sse";
import type { CardCreateRequest, CardCreateResponse } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type Phase = "generating" | "storing" | "error";

// The backend only reports a single "generating" step for both the design and handwriting
// AI calls (see services/api/app/service/cards.py). 35 is that step's pct checkpoint right
// after design generation finishes and right before handwriting generation starts — keep
// this in sync with that file if its checkpoints ever change.
const HANDWRITING_STARTS_AT_PCT = 35;

function getStepLabel(phase: Phase, pct: number): string {
  if (phase === "generating") return pct < HANDWRITING_STARTS_AT_PCT ? "Designing your card…" : "Rendering handwriting…";
  if (phase === "storing") return "Saving…";
  return "Working…";
}

type Props = {
  request: CardCreateRequest;
  designPreviewPromiseRef: RefObject<Promise<string | null>>;
  onBack: () => void;
};

export function StepGenerate({ request, designPreviewPromiseRef, onBack }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("generating");
  const [pct, setPct] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function run() {
      try {
        const design_preview_id = await designPreviewPromiseRef.current;
        const createRes = await apiFetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...request, design_preview_id }),
        });
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}));
          throw new Error(body.detail ? JSON.stringify(body.detail) : `Card creation failed (${createRes.status})`);
        }
        const { card_id } = (await createRes.json()) as CardCreateResponse;

        const streamRes = await apiFetch(`/api/cards/${card_id}/stream`);
        if (!streamRes.ok) throw new Error(`Stream failed (${streamRes.status})`);

        for await (const evt of parseSSE(streamRes)) {
          const data = JSON.parse(evt.data);
          if (evt.event === "status") {
            setPhase(data.step);
            setPct(data.pct);
          } else if (evt.event === "complete") {
            dashboardCache.invalidateCards();
            router.replace(`/card/${card_id}`);
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

    run();
  }, [request, designPreviewPromiseRef, router]);

  if (phase === "error") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-destructive">{errorMessage}</p>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Generating your card</h2>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {getStepLabel(phase, pct)}
      </p>
      <Progress value={pct} />
    </div>
  );
}
