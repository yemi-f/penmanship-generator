"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const MAX_DESCRIPTION_LENGTH = 500;

type Props = {
  designDescription: string;
  onChange: (designDescription: string) => void;
};

export function StepDesign({ designDescription, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Design</h2>
      <Label htmlFor="design-description">
        Describe what you want on the front of the card
      </Label>
      <Textarea
        id="design-description"
        value={designDescription}
        maxLength={MAX_DESCRIPTION_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="e.g. A watercolour painting of a lighthouse at sunset, soft pastel colours…"
      />
      <p className="self-end text-xs text-muted-foreground">
        {designDescription.length} / {MAX_DESCRIPTION_LENGTH}
      </p>
    </div>
  );
}
