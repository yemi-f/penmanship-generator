"use client";

import { useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { CardCreateRequest, CardType, DesignPreviewCreateRequest, Orientation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StepCardType } from "@/components/CreateFlow/StepCardType";
import { StepHandwriting } from "@/components/CreateFlow/StepHandwriting";
import { StepDesign } from "@/components/CreateFlow/StepDesign";
import { StepMessage } from "@/components/CreateFlow/StepMessage";
import { StepGenerate } from "@/components/CreateFlow/StepGenerate";

const STEP_TITLES = ["Card type", "Handwriting", "Design", "Message", "Generate"];

function fireDesignPreview(payload: DesignPreviewCreateRequest): Promise<string | null> {
  return apiFetch("/api/design-previews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => (res.ok ? ((await res.json()).design_preview_id as string) : null))
    .catch(() => null); // never rejects — callers don't need their own try/catch
}

export function CreateFlow() {
  const [step, setStep] = useState(1);
  const [cardType, setCardType] = useState<CardType>("postcard");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [designDescription, setDesignDescription] = useState("");
  const [handwritingStyle, setHandwritingStyle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [signOff, setSignOff] = useState("");
  const [designPreviewStatus, setDesignPreviewStatus] = useState<"idle" | "pending" | "ready" | "error">("idle");
  const designPreviewPromiseRef = useRef<Promise<string | null>>(Promise.resolve(null));

  const canAdvance =
    (step === 1 && true) ||
    (step === 2 && handwritingStyle !== "") ||
    (step === 3 && designDescription.trim().length > 0) ||
    (step === 4 &&
      message.trim().length > 0 &&
      (cardType !== "postcard" || (recipientName.trim().length > 0 && signOff.trim().length > 0)));

  const request: CardCreateRequest = {
    card_type: cardType,
    orientation,
    design_description: designDescription,
    handwriting_style: handwritingStyle,
    message,
    design_preview_id: null,
    recipient_name: cardType === "postcard" ? recipientName : null,
    sign_off: cardType === "postcard" ? signOff : null,
  };

  function handleNext() {
    if (step === 3) {
      setDesignPreviewStatus("pending");
      designPreviewPromiseRef.current = fireDesignPreview({
        card_type: cardType,
        orientation,
        design_description: designDescription,
      }).then((id) => {
        setDesignPreviewStatus(id ? "ready" : "error");
        return id;
      });
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      {step < 5 && (
        <ol className="flex gap-4 text-xs text-muted-foreground">
          {STEP_TITLES.map((title, i) => (
            <li key={title} className={i + 1 === step ? "font-semibold text-foreground" : ""}>
              {i + 1}. {title}
            </li>
          ))}
        </ol>
      )}

      {step === 1 && (
        <StepCardType
          cardType={cardType}
          orientation={orientation}
          onChange={(t, o) => {
            setCardType(t);
            setOrientation(o);
          }}
        />
      )}
      {step === 2 && <StepHandwriting handwritingStyle={handwritingStyle} onChange={setHandwritingStyle} />}
      {step === 3 && <StepDesign designDescription={designDescription} onChange={setDesignDescription} />}
      {step === 4 && (
        <>
          <StepMessage
            cardType={cardType}
            message={message}
            onChange={setMessage}
            recipientName={recipientName}
            onRecipientNameChange={setRecipientName}
            signOff={signOff}
            onSignOffChange={setSignOff}
          />
          {designPreviewStatus === "pending" && (
            <p className="text-xs text-muted-foreground">Preparing your design…</p>
          )}
          {designPreviewStatus === "ready" && (
            <p className="text-xs text-muted-foreground">✓ Design ready</p>
          )}
        </>
      )}
      {step === 5 && (
        <StepGenerate
          request={request}
          designPreviewPromiseRef={designPreviewPromiseRef}
          onBack={() => setStep(4)}
        />
      )}

      {step < 5 && (
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
            Back
          </Button>
          <Button type="button" onClick={handleNext} disabled={!canAdvance}>
            {step === 4 ? "Generate" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}
