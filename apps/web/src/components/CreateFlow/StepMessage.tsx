"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CardType } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 500;

type Props = {
  cardType: CardType;
  message: string;
  onChange: (message: string) => void;
  recipientName: string;
  onRecipientNameChange: (recipientName: string) => void;
  signOff: string;
  onSignOffChange: (signOff: string) => void;
};

export function StepMessage({
  cardType,
  message,
  onChange,
  recipientName,
  onRecipientNameChange,
  signOff,
  onSignOffChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Message</h2>
      <Label htmlFor="card-message">What do you want to say?</Label>
      <Textarea
        id="card-message"
        value={message}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="Write your message here…"
      />
      <p className="self-end text-xs text-muted-foreground">
        {message.length} / {MAX_MESSAGE_LENGTH}
      </p>

      {cardType === "postcard" && (
        <>
          <Label htmlFor="card-recipient-name">To</Label>
          <Input
            id="card-recipient-name"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            placeholder="Recipient's name"
          />

          <Label htmlFor="card-sign-off">Sign off</Label>
          <Textarea
            id="card-sign-off"
            value={signOff}
            onChange={(e) => onSignOffChange(e.target.value)}
            rows={2}
            placeholder={"Cheers,\nMary"}
          />
        </>
      )}
    </div>
  );
}
