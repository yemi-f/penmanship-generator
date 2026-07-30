export type CardType = "postcard" | "greeting_card";
export type Orientation = "landscape" | "portrait";

export type DefaultStyleOption = { slug: string; label: string; preview_url: string };
export type SavedSampleOption = {
  sample_id: string;
  label: string;
  sample_url: string;
  sample_thumb_url: string | null;
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
  recipient_name: string | null; // postcard only, required
  sign_off: string | null; // required for postcard, optional for greeting_card
};

export type CardCreateResponse = { card_id: string; share_token: string };

export type CardUpdateRequest = {
  design_description: string;
  message: string;
  recipient_name: string | null;
  sign_off: string | null;
};

export type CardUpdateResponse = { regenerate_design: boolean; regenerate_writing: boolean };

export type GenerationCompleteData = {
  writing_face_url: string;
  design_url: string;
  share_url: string;
};

export type CardStatus = "pending" | "complete" | "failed";

export type CardMeta = {
  card_id: string;
  user_id: string;
  created_at: string;
  card_type: CardType;
  orientation: Orientation;
  design_description: string;
  design_url: string | null;
  design_thumb_url: string | null;
  handwriting_style: string;
  handwriting_label: string;
  message: string;
  status: CardStatus;
  writing_face_url: string | null;
  share_token: string;
  design_preview_id: string | null;
  recipient_name: string | null;
  sign_off: string | null;
};

export type ShareData = {
  card_type: CardType;
  orientation: Orientation;
  design_url: string | null;
  writing_face_url: string | null;
  created_at: string;
};
