"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const MAX_MESSAGE_LENGTH = 500;

type Props = {
  message: string;
  onChange: (message: string) => void;
};

export function StepMessage({ message, onChange }: Props) {
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
    </div>
  );
}
