export type ModelId = "cleanup-pictures" | "lightx";

export type EditRequestPayload = {
  originalImage: Buffer;
  originalMimeType: string;
  maskImage: Buffer;
  maskMimeType: string;
  prompt: string;
  seed?: string;
};

export type EditResponsePayload = {
  editedImage: Buffer;
  mimeType: string;
};
