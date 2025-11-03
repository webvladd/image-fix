import type { EditRequestPayload, EditResponsePayload, ModelId } from "../types.js";

export interface ImageEditProvider {
  readonly id: ModelId;
  readonly label: string;
  isConfigured(): boolean;
  edit(payload: EditRequestPayload): Promise<EditResponsePayload>;
}
