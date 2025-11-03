import { createCleanupPicturesProvider } from "./cleanupPicturesProvider.js";
import { createLightxProvider } from "./lightxProvider.js";
import type { ImageEditProvider } from "./types.js";
import type { ModelId } from "../types.js";

let providerMap: Map<ModelId, ImageEditProvider> | undefined;

function ensureProviders(): Map<ModelId, ImageEditProvider> {
  if (!providerMap) {
    const providers: ImageEditProvider[] = [
      createCleanupPicturesProvider({
        apiKey: process.env.CLEANUP_PICTURES_API_KEY,
        endpoint: process.env.CLEANUP_PICTURES_API_URL,
        authHeader: 'x-api-key',
      }),
      createLightxProvider({
        apiKey: process.env.LIGHTX_API_KEY,
        authHeader: 'x-api-key',
        authScheme: process.env.LIGHTX_AUTH_SCHEME,
        uploadUrl: process.env.LIGHTX_UPLOAD_URL,
        cleanupUrl: process.env.LIGHTX_CLEANUP_URL,
        statusUrl: process.env.LIGHTX_STATUS_URL,
        pollIntervalMs: process.env.LIGHTX_POLL_INTERVAL_MS,
        maxStatusChecks: process.env.LIGHTX_MAX_STATUS_CHECKS,
      }),
    ];

    providerMap = new Map<ModelId, ImageEditProvider>(providers.map((provider) => [provider.id, provider]));
  }

  return providerMap!;
}

export function getProvider(modelId: ModelId): ImageEditProvider | undefined {
  return ensureProviders().get(modelId);
}

export function listProviders(): ImageEditProvider[] {
  return Array.from(ensureProviders().values());
}
