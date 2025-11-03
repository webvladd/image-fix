import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config } from "dotenv";
import { getProvider } from "./providers/index.js";
import {
  ProviderConfigurationError,
  ProviderError,
  ProviderQuotaExceededError,
  ProviderRequestError,
} from "./providers/errors.js";
import type { EditRequestPayload, ModelId } from "./types.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
const hasClientBundle = existsSync(clientIndexPath);

const server = Fastify({ logger: true });

await server.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 2,
  },
});

if (hasClientBundle) {
  await server.register(fastifyStatic, {
    root: clientDistPath,
    prefix: "/",
  });

  server.setNotFoundHandler((request, reply) => {
    const isApiRoute = request.url.startsWith("/api");
    const isAsset = request.url.startsWith("/assets/");
    const isHtmlRequest = request.method === "GET" || request.method === "HEAD";

    if (!isHtmlRequest || isApiRoute || isAsset) {
      reply.code(404).send({ message: `Route ${request.method} ${request.url} not found` });
      return;
    }

    reply.type("text/html").sendFile("index.html");
  });
} else {
  server.log.warn(
    { clientDistPath },
    "Static client bundle not found. Only API routes will be served.",
  );
}

const MODEL_IDS: ModelId[] = ["cleanup-pictures", "lightx"];

function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && MODEL_IDS.includes(value as ModelId);
}

server.post("/api/edit", async (request, reply) => {
  const parts = request.parts();

  let prompt: string | undefined;
  let originalImage: Buffer | undefined;
  let originalMimeType: string | undefined;
  let maskImage: Buffer | undefined;
  let maskMimeType: string | undefined;
  let modelId: ModelId | undefined;
  let seed: string | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      const fileBuffer = await part.toBuffer();
      if (part.fieldname === "originalImage") {
        originalImage = fileBuffer;
        originalMimeType = part.mimetype;
      }
      if (part.fieldname === "maskImage") {
        maskImage = fileBuffer;
        maskMimeType = part.mimetype;
      }
    } else if (part.type === "field") {
      if (part.fieldname === "prompt") {
        prompt = part.value as string;
      } else if (part.fieldname === "modelId") {
        const candidate = part.value as string;
        if (isModelId(candidate)) {
          modelId = candidate;
        }
      } else if (part.fieldname === "seed") {
        seed = part.value as string;
      }
    }
  }

  if (!prompt || !originalImage || !maskImage || !originalMimeType || !maskMimeType) {
    reply.code(400).send({ error: "originalImage, maskImage, and prompt are required" });
    return;
  }

  const resolvedModelId = modelId ?? "cleanup-pictures";
  const provider = getProvider(resolvedModelId);

  if (!provider) {
    reply.code(400).send({ error: `Unknown model identifier: ${resolvedModelId}` });
    return;
  }

  const payload: EditRequestPayload = {
    prompt,
    originalImage,
    originalMimeType,
    maskImage,
    maskMimeType,
    seed,
  };

  try {
    const { editedImage, mimeType } = await provider.edit(payload);
    reply.header("Content-Type", mimeType);
    reply.header("Cache-Control", "no-store");
    reply.send(editedImage);
  } catch (error) {
    if (error instanceof ProviderQuotaExceededError) {
      request.log.warn({ err: error }, "Image edit quota exceeded");
      reply.code(429).send({ error: "Image editing quota reached. Please wait before retrying." });
      return;
    }

    if (error instanceof ProviderConfigurationError) {
      request.log.warn({ err: error }, "Provider configuration error");
      reply.code(error.status ?? 400).send({ error: error.message });
      return;
    }

    if (error instanceof ProviderRequestError || error instanceof ProviderError) {
      request.log.error({ err: error }, "Provider request failed");
      reply.code(error.status ?? 502).send({ error: error.message });
      return;
    }

    request.log.error({ err: error }, "Image edit failed");
    reply.code(500).send({ error: "Failed to process edit request" });
  }
});

const port = Number.parseInt(process.env.PORT ?? "5050", 10);

try {
  await server.listen({ port, host: "0.0.0.0" });
  console.info(`Fastify server listening on http://localhost:${port}`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
