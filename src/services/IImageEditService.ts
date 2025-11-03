import type { EditPayload, RegeneratePayload } from "@types";

export interface IImageEditService {
  editImage(payload: EditPayload): Promise<Blob>;
  regenerate(payload: RegeneratePayload): Promise<Blob>;
}
