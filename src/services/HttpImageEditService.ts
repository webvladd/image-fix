import axios from "axios";
import type { EditPayload, RegeneratePayload } from "@types";
import type { IImageEditService } from "@services/IImageEditService";

const API_PATH = "/api/edit";

export class HttpImageEditService implements IImageEditService {
  async editImage(payload: EditPayload): Promise<Blob> {
    return this.sendRequest(payload);
  }

  async regenerate(payload: RegeneratePayload): Promise<Blob> {
    return this.sendRequest(payload);
  }

  private async sendRequest(payload: EditPayload | RegeneratePayload): Promise<Blob> {
    const { original, mask, prompt, modelId } = payload;
    const seed = (payload as RegeneratePayload).seed;
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("originalImage", original, "original.png");
    formData.append("maskImage", mask, "mask.png");
    formData.append("modelId", modelId);
    if (seed) {
      formData.append("seed", seed);
    }

    const response = await axios.post(API_PATH, formData, {
      responseType: "blob",
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  }
}
