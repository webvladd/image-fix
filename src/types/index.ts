export type LoadedImage = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  name: string;
};

export type MaskUpdate = {
  blob: Blob;
  isEmpty: boolean;
};

export type ModelId = "cleanup-pictures" | "lightx";

export type EditPayload = {
  original: Blob;
  mask: Blob;
  prompt: string;
  modelId: ModelId;
};

export type RegeneratePayload = EditPayload & {
  seed?: string;
};
