"use client";

import { Maximize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type Props = {
  src: string;
  fullSrc: string;
  alt: string;
  onImgError?: React.ReactEventHandler<HTMLImageElement>;
};

export function SampleThumbnail({ src, fullSrc, alt, onImgError }: Props) {
  return (
    <Dialog>
      <div className="group relative">
        <img
          src={src}
          alt={alt}
          className="aspect-[4/3] w-full rounded object-cover"
          onError={onImgError}
        />
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              aria-label={`View ${alt} larger`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="absolute top-1 right-1 rounded-full opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Maximize2 />
            </Button>
          }
        />
      </div>
      <DialogContent className="max-w-[90vw] sm:max-w-2xl">
        <div className="relative">
          <img src={fullSrc} alt={alt} className="max-h-[80vh] w-full rounded object-contain" />
          <DialogClose
            render={
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Close"
                className="absolute top-2 right-2 rounded-full"
              >
                <X />
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
