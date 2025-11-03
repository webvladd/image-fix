import { Buffer } from "node:buffer";
import type { EditRequestPayload, EditResponsePayload } from "../types.js";
import { ProviderConfigurationError, ProviderQuotaExceededError, ProviderRequestError } from "./errors.js";
import type { ImageEditProvider } from "./types.js";
import { resolveImageMimeType } from "./imageUtils.js";

const DEFAULT_ENDPOINT = "https://clipdrop-api.co/cleanup/v1";

type CleanupPicturesConfig = {
  apiKey?: string;
  endpoint?: string;
  authHeader?: string;
  authScheme?: string;
};

function bufferToBlob(buffer: Buffer, mimeType: string): Blob {
  const uint8 = Uint8Array.from(buffer);
  return new Blob([uint8], { type: mimeType });
}

async function callCleanupPictures(
  config: Required<Pick<CleanupPicturesConfig, "apiKey" | "endpoint">> &
    Pick<CleanupPicturesConfig, "authHeader" | "authScheme">,
  payload: EditRequestPayload
): Promise<EditResponsePayload> {
  const formData = new FormData();
  const originalMime = payload.originalMimeType ?? "image/png";
  const maskMime = payload.maskMimeType ?? "image/png";

  formData.append(
    "image_file",
    bufferToBlob(payload.originalImage, originalMime),
    `original.${originalMime.split("/")[1] ?? "png"}`
  );
  formData.append(
    "mask_file",
    bufferToBlob(payload.maskImage, maskMime),
    `mask.${maskMime.split("/")[1] ?? "png"}`
  );

  const headers: Record<string, string> = {};
  const headerName = config.authHeader?.trim() || "x-api-key";
  const scheme = config.authScheme?.trim();
  headers[headerName] = scheme ? `${scheme} ${config.apiKey}` : config.apiKey;

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    throw new ProviderConfigurationError("Cleanup.pictures API key was rejected.");
  }

  if (response.status === 429) {
    throw new ProviderQuotaExceededError("Cleanup.pictures quota exceeded.");
  }

  if (response.status === 402) {
    throw new ProviderQuotaExceededError(
      "Cleanup.pictures free лимит закончился. Пополните баланс или выберите другой провайдер."
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = resolveImageMimeType(response.headers.get("content-type"), buffer);

  if (!response.ok || !mimeType) {
    const hint = response.ok
      ? `Получен неожиданный ответ размером ${buffer.length} байт (content-type: ${response.headers.get("content-type") ?? "не указан"}).`
      : `Cleanup.pictures error: ${response.status} ${response.statusText}`;
    throw new ProviderRequestError(hint, response.ok ? undefined : response.status);
  }

  return {
    editedImage: buffer,
    mimeType,
  };
}

export function createCleanupPicturesProvider(config: CleanupPicturesConfig): ImageEditProvider {
  return {
    id: "cleanup-pictures",
    label: "Cleanup.pictures",
    isConfigured() {
      return Boolean(config.apiKey);
    },
    async edit(payload: EditRequestPayload): Promise<EditResponsePayload> {
      if (!config.apiKey) {
        throw new ProviderConfigurationError("Cleanup.pictures API key is not configured.");
      }

      return await callCleanupPictures(
        {
          apiKey: config.apiKey,
          endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
          authHeader: config.authHeader,
          authScheme: config.authScheme,
        },
        payload
      );
    },
  };
}
