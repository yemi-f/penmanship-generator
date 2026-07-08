export type CardType = "postcard" | "greeting_card";
export type Orientation = "landscape" | "portrait";

export type DefaultStyleOption = { slug: string; label: string; preview_url: string };
export type SavedSampleOption = {
  sample_id: string;
  label: string;
  sample_url: string;
  created_at: string;
};

export type DesignPreviewCreateRequest = {
  card_type: CardType;
  orientation: Orientation;
  design_description: string;
};

export type CardCreateRequest = {
  card_type: CardType;
  orientation: Orientation;
  design_description: string;
  handwriting_style: string; // "default:{slug}" | "saved:{sample_id}"
  message: string;
  design_preview_id: string | null;
};

export type CardCreateResponse = { card_id: string; share_token: string };

export type GenerationCompleteData = {
  writing_face_url: string;
  design_url: string;
  share_url: string;
};
