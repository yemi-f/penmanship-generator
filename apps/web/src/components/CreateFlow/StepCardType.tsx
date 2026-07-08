"use client";

import { Button } from "@/components/ui/button";
import type { CardType, Orientation } from "@/lib/types";

type Props = {
  cardType: CardType;
  orientation: Orientation;
  onChange: (cardType: CardType, orientation: Orientation) => void;
};

export function StepCardType({ cardType, orientation, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold">Card type</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={cardType === "postcard" ? "default" : "outline"}
            onClick={() => onChange("postcard", "landscape")}
          >
            Postcard
          </Button>
          <Button
            type="button"
            variant={cardType === "greeting_card" ? "default" : "outline"}
            onClick={() => onChange("greeting_card", orientation)}
          >
            Greeting Card
          </Button>
        </div>
      </div>

      {cardType === "greeting_card" && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Orientation</h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={orientation === "portrait" ? "default" : "outline"}
              onClick={() => onChange(cardType, "portrait")}
            >
              Portrait
            </Button>
            <Button
              type="button"
              variant={orientation === "landscape" ? "default" : "outline"}
              onClick={() => onChange(cardType, "landscape")}
            >
              Landscape
            </Button>
          </div>
        </div>
      )}

      {cardType === "postcard" && (
        <p className="text-sm text-muted-foreground">Postcards are always landscape.</p>
      )}
    </div>
  );
}
