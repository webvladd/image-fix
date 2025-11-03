# ImageFix

ImageFix is a minimal single-page admin utility that helps a media team clean up creative assets before resubmitting them. Admins upload an image, paint a mask over areas to remove, and generate a cleaned-up variant through a protected backend proxy using cleanup.pictures or LightX/Lovart-style inpainting APIs.

## Prerequisites

- Node.js 20.11 or newer (Fastify + Vite both rely on modern ESM support)
- npm 10+ (bundled with the recommended Node.js release)

## Installation

```bash
npm install
```

## Environment

Duplicate `.env.example` and supply the relevant credentials:

```bash
cp .env.example .env
# Edit .env and set the variables you need
```

### Provider overview

- **Cleanup.pictures** – Sends the masked image to the cleanup.pictures API for high quality background restoration.
- **LightX / Lovart Object Remover** – Fully automated integration with LightX Cleanup Picture v2: the backend uploads the original image and mask via the Upload API, starts the cleanup job, and polls the status until the result is ready.

## Development Workflow

### Run both servers (frontend + proxy)

```bash
npm run dev
```

- Launches Fastify on `http://localhost:5050`
- Starts Vite with React 19 + TypeScript + HMR
- Proxies `/api/*` requests from Vite to the Fastify server during development

If you prefer to run them separately you can still use:

```bash
npm run start:server
# and in another terminal
npm run dev:client
```

### Test the end-to-end flow locally

1. Start the combined dev command (`npm run dev`).
2. Open the printed URL (default `http://localhost:5173`).
3. Upload a JPEG/PNG/WEBP image under 10MB.
4. Paint the mask over the unwanted area.
5. Choose the desired **Model** (Cleanup.pictures or LightX/Lovart).
6. Click **Generate fix** to call the proxy.
7. Use **Regenerate** to request another variant (reuses the current mask and selected provider).

If the selected provider is unavailable (quota, misconfiguration, network), the UI shows the returned error message and leaves the previous image in place so the flow remains functional in development.

## Available Scripts

- `npm run dev` – Run Fastify proxy and Vite client together (parallel)
- `npm run dev:client` – Start only the Vite dev server
- `npm run dev:server` – Start only the Fastify proxy in dev mode
- `npm run build` – Type-check and bundle the frontend for production
- `npm run preview` – Preview the production build
- `npm run lint:styles` – Run stylelint against all SCSS files
- `npm run start:server` – Launch the Fastify proxy once via tsx (standalone)
