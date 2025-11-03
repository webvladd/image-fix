import { Buffer } from "node:buffer";
import type { EditRequestPayload, EditResponsePayload } from "../types.js";
import { ProviderConfigurationError, ProviderQuotaExceededError, ProviderRequestError } from "./errors.js";
import type { ImageEditProvider } from "./types.js";
import { resolveImageMimeType } from "./imageUtils.js";

type LightXProviderConfig = {
  apiKey?: string;
  authHeader?: string;
  authScheme?: string;
  uploadUrl?: string;
  cleanupUrl?: string;
  statusUrl?: string;
  pollIntervalMs?: string | number;
  maxStatusChecks?: string | number;
};

const DEFAULT_UPLOAD_URL = "https://api.lightxeditor.com/external/api/v2/uploadImageUrl";
const DEFAULT_CLEANUP_URL = "https://api.lightxeditor.com/external/api/v2/cleanup-picture";
const DEFAULT_STATUS_URL = "https://api.lightxeditor.com/external/api/v2/order-status";
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_STATUS_CHECKS = 5;
const RESULT_DOWNLOAD_MAX_ATTEMPTS = 5;
const RESULT_DOWNLOAD_RETRY_DELAY_MS = 2000;

type AuthConfig = {
  apiKey: string;
  headerName: string;
  headerValue: string;
};

function resolveNumber(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  return fallback;
}

function bufferSize(buffer: Buffer): number {
  return buffer.byteLength ?? buffer.length;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const view = Uint8Array.from(buffer);
  return view.buffer;
}

async function handleErrorResponse(response: Response, providerName: string): Promise<never> {
  if (response.status === 401 || response.status === 403) {
    throw new ProviderConfigurationError(`${providerName} API key was rejected.`);
  }

  if (response.status === 402) {
    throw new ProviderQuotaExceededError(`${providerName} quota exceeded.`);
  }

  if (response.status === 429) {
    throw new ProviderQuotaExceededError(`${providerName} quota exceeded.`);
  }

  const text = await response.text().catch(() => "");
  throw new ProviderRequestError(
    text ? `${providerName} error response: ${text}` : `${providerName} error: ${response.status} ${response.statusText}`,
    response.status
  );
}

async function requestUploadSlot(
  url: string,
  size: number,
  contentType: string,
  auth: AuthConfig
): Promise<{ uploadUrl: string; finalUrl: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [auth.headerName]: auth.headerValue,
    },
    body: JSON.stringify({
      uploadType: "imageUrl",
      size,
      contentType,
    }),
  });

  if (!response.ok) {
    await handleErrorResponse(response, "Object remover");
  }

  const json = (await response.json()) as {
    statusCode?: number;
    message?: string;
    body?: {
      uploadImage?: string;
      imageUrl?: string;
    };
  };

  const uploadImage = json?.body?.uploadImage;
  const imageUrl = json?.body?.imageUrl;

  if (json?.statusCode !== 2000 || !uploadImage || !imageUrl) {
    throw new ProviderRequestError(
      `Object remover upload API returned an unexpected payload${
        json?.message ? `: ${json.message}` : ""
      }.`
    );
  }

  return { uploadUrl: uploadImage, finalUrl: imageUrl };
}

async function uploadFileToPresignedUrl(url: string, buffer: Buffer, mimeType: string): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: bufferToArrayBuffer(buffer),
  });

  if (!response.ok) {
    throw new ProviderRequestError(`Failed to upload asset: ${response.status} ${response.statusText}`);
  }
}

async function triggerCleanup(
  url: string,
  auth: AuthConfig,
  imageUrl: string,
  maskedImageUrl: string
): Promise<{ orderId?: string; status?: string; output?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [auth.headerName]: auth.headerValue,
    },
    body: JSON.stringify({
      imageUrl,
      maskedImageUrl,
    }),
  });

  if (!response.ok) {
    await handleErrorResponse(response, "Object remover");
  }

  const json = (await response.json()) as {
    statusCode?: number;
    message?: string;
    body?: {
      orderId?: string;
      status?: string;
      output?: string;
    };
  };

  if (json?.statusCode !== 2000 || !json?.body) {
    throw new ProviderRequestError(
      `Object remover cleanup response is invalid${json?.message ? `: ${json.message}` : ""}.`
    );
  }

  return json.body;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOrderStatus(
  url: string,
  auth: AuthConfig,
  orderId: string,
  maxChecks: number,
  intervalMs: number
): Promise<EditResponsePayload> {
  for (let attempt = 0; attempt < maxChecks; attempt += 1) {
    if (attempt > 0) {
      await delay(intervalMs);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [auth.headerName]: auth.headerValue,
      },
      body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
      await handleErrorResponse(response, "Object remover");
    }

    const json = (await response.json()) as {
      statusCode?: number;
      message?: string;
      body?: {
        status?: string;
        output?: string;
      };
    };

    if (json?.statusCode !== 2000 || !json?.body) {
      throw new ProviderRequestError(
        `Object remover status response is invalid${json?.message ? `: ${json.message}` : ""}.`
      );
    }

    const status = json?.body?.status;
    const output = json?.body?.output;

    if (status === "active" && output) {
      try {
        return await downloadResult(output, auth);
      } catch (error) {
        if (error instanceof ProviderRequestError && attempt < maxChecks - 1) {
          continue;
        }
        throw error;
      }
    }

    if (status === "failed") {
      throw new ProviderRequestError("Object remover failed to process the image.");
    }
  }

  throw new ProviderRequestError("Object remover timed out while generating the edited image.");
}

async function downloadResult(url: string, auth: AuthConfig): Promise<EditResponsePayload> {
  const visited = new Set<string>([url]);
  let currentUrl = url;
  let lastPreview = "";
  let lastStatus: number | undefined;
  let lastStatusText: string | undefined;
  let lastContentType: string | null | undefined;
  let lastBodyLength = 0;

  for (let attempt = 0; attempt < RESULT_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(RESULT_DOWNLOAD_RETRY_DELAY_MS);
    }

    const response = await fetch(currentUrl, {
      headers: {
        [auth.headerName]: auth.headerValue,
      },
    });
    lastStatus = response.status;
    lastStatusText = response.statusText;
    lastContentType = response.headers.get("content-type");

    if (response.status === 401 || response.status === 403) {
      throw new ProviderConfigurationError("Object remover API key was rejected.");
    }

    if (response.status === 402 || response.status === 429) {
      throw new ProviderQuotaExceededError("Object remover quota exceeded.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = resolveImageMimeType(lastContentType, buffer);
    lastBodyLength = buffer.length;

    if (response.ok && mimeType) {
      return {
        editedImage: buffer,
        mimeType,
      };
    }

    let text: string | undefined;
    if (buffer.length > 0) {
      try {
        const decoded = buffer.toString("utf8");
        if (decoded && !decoded.includes("\uFFFD")) {
          text = decoded;
          lastPreview = decoded.slice(0, 200).trim();
        }
      } catch {
        // ignore decoding failures for binary data
      }
    }

    let json: {
      statusCode?: number;
      message?: string;
      status?: string;
      output?: string;
      url?: string;
      body?: {
        status?: string;
        output?: string;
        imageUrl?: string;
        url?: string;
        message?: string;
      };
    } | undefined;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // not a JSON payload
      }
    }

    if (json) {
      const nestedUrl =
        json.body?.output ?? json.body?.imageUrl ?? json.body?.url ?? json.output ?? json.url;

      if (typeof nestedUrl === "string" && nestedUrl.length > 0 && !visited.has(nestedUrl)) {
        visited.add(nestedUrl);
        currentUrl = nestedUrl;
        // restart attempts for the new URL
        attempt = -1;
        continue;
      }

      const status = json.body?.status ?? json.status;
      if (status && status !== "active") {
        continue;
      }

      if (json.message) {
        lastPreview = json.message.slice(0, 200);
      } else if (!lastPreview && json.body?.message) {
        lastPreview = json.body.message.slice(0, 200);
      }
    }

    if ((response.status === 404 || response.status === 500 || response.status === 503) && attempt < RESULT_DOWNLOAD_MAX_ATTEMPTS - 1) {
      continue;
    }

    break;
  }

  const statusSuffix = lastStatus
    ? ` Статус: ${lastStatus}${lastStatusText ? ` ${lastStatusText}` : ""}, content-type: ${lastContentType ?? "не указан"}, тело: ${lastBodyLength} байт.`
    : "";
  const previewSuffix = lastPreview ? ` Ответ: ${lastPreview}` : "";
  const errorMessage = `Object remover не смог вернуть готовое изображение.${statusSuffix}${previewSuffix}`;
  throw new ProviderRequestError(errorMessage);
}

export function createLightxProvider(config: LightXProviderConfig): ImageEditProvider {
  const { apiKey, authHeader, authScheme } = config;
  const uploadUrl = config.uploadUrl ?? DEFAULT_UPLOAD_URL;
  const cleanupUrl = config.cleanupUrl ?? DEFAULT_CLEANUP_URL;
  const statusUrl = config.statusUrl ?? DEFAULT_STATUS_URL;
  const pollIntervalMs = resolveNumber(config.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
  const maxStatusChecks = resolveNumber(config.maxStatusChecks, DEFAULT_MAX_STATUS_CHECKS);

  return {
    id: "lightx",
    label: "LightX / Lovart Object Remover",
    isConfigured() {
      return Boolean(apiKey);
    },
    async edit(payload: EditRequestPayload): Promise<EditResponsePayload> {
      if (!apiKey) {
        throw new ProviderConfigurationError("Object remover API key is not configured.");
      }

      const headerName = authHeader?.trim() || "x-api-key";
      const scheme = authScheme?.trim();
      const headerValue = scheme ? `${scheme} ${apiKey}` : apiKey;
      const auth: AuthConfig = {
        apiKey,
        headerName,
        headerValue,
      };

      const originalMime = payload.originalMimeType ?? "image/png";
      const maskMime = payload.maskMimeType ?? "image/png";

      const originalSlot = await requestUploadSlot(uploadUrl, bufferSize(payload.originalImage), originalMime, auth);
      await uploadFileToPresignedUrl(originalSlot.uploadUrl, payload.originalImage, originalMime);

      const maskSlot = await requestUploadSlot(uploadUrl, bufferSize(payload.maskImage), maskMime, auth);
      await uploadFileToPresignedUrl(maskSlot.uploadUrl, payload.maskImage, maskMime);

      const cleanupResult = await triggerCleanup(cleanupUrl, auth, originalSlot.finalUrl, maskSlot.finalUrl);

      if (cleanupResult.status === "active" && cleanupResult.output) {
        try {
          return await downloadResult(cleanupResult.output, auth);
        } catch (error) {
          if (!(error instanceof ProviderRequestError) || !cleanupResult.orderId) {
            throw error;
          }
          return await pollOrderStatus(statusUrl, auth, cleanupResult.orderId, maxStatusChecks, pollIntervalMs);
        }
      }

      if (!cleanupResult.orderId) {
        throw new ProviderRequestError("Object remover response missing order identifier for follow-up polling.");
      }

      return await pollOrderStatus(statusUrl, auth, cleanupResult.orderId, maxStatusChecks, pollIntervalMs);
    },
  };
}
