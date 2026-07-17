"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Check, Copy } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { parseSSE } from "@/lib/sse";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import type { CardCreateRequest, CardCreateResponse, GenerationCompleteData } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const SHARE_LINK_COPY_ID = "share-link";

type Phase = "generating" | "storing" | "complete" | "error";

const STEP_LABELS: Record<string, string> = {
  generating: "Rendering handwriting…",
  storing: "Saving…",
};

type Props = {
  request: CardCreateRequest;
  designPreviewPromiseRef: RefObject<Promise<string | null>>;
  onBack: () => void;
};

export function StepGenerate({ request, designPreviewPromiseRef, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("generating");
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<GenerationCompleteData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);
  const { copiedId, copy } = useCopyToClipboard();

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
            setResult(data as GenerationCompleteData);
            setPhase("complete");
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
  }, [request, designPreviewPromiseRef]);

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

  if (phase === "complete" && result) {
    const shareLink =
      typeof window !== "undefined" ? `${window.location.origin}${result.share_url}` : result.share_url;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Your card is ready</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Design</p>
            <img src={result.design_url} alt="Card design" className="w-full rounded-md border" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Handwriting</p>
            <img src={result.writing_face_url} alt="Handwritten message" className="w-full rounded-md border" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={shareLink} className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <Button type="button" onClick={() => copy(SHARE_LINK_COPY_ID, shareLink)}>
            {copiedId === SHARE_LINK_COPY_ID ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {copiedId === SHARE_LINK_COPY_ID ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Generating your card</h2>
      <p className="text-sm text-muted-foreground">{STEP_LABELS[phase] ?? "Working…"}</p>
      <Progress value={pct} />
    </div>
  );
}
