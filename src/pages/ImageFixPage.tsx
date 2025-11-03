import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaskCanvas } from "@components/MaskCanvas";
import { EditControls } from "@components/EditControls";
import { ResultPreview } from "@components/ResultPreview";
import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { useImageFixService } from "@hooks/useImageFixService";
import { useTranslation } from "@i18n/TranslationProvider";
import type { TranslationKey } from "@i18n/translations";
import type { EditPayload, LoadedImage, MaskUpdate, ModelId, RegeneratePayload } from "@types";

type RequestState = "idle" | "loading" | "error";

const DEFAULT_PROMPT = "Remove the masked area";

export default function ImageFixPage() {
  const imageService = useImageFixService();
  const { t } = useTranslation();
  const [originalImage, setOriginalImage] = useState<LoadedImage | null>(null);
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  const [modelId, setModelId] = useState<ModelId>("cleanup-pictures");
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const lastPayloadRef = useRef<RegeneratePayload | null>(null);

  const clearErrors = useCallback(() => {
    setErrorKey(null);
    setErrorOverride(null);
  }, []);

  useEffect(() => {
    if (!editedBlob) {
      if (editedUrl) {
        URL.revokeObjectURL(editedUrl);
        setEditedUrl(null);
      }
      return;
    }

    const url = URL.createObjectURL(editedBlob);
    setEditedUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [editedBlob]);

  useEffect(
    () => () => {
      if (originalImage?.url) {
        URL.revokeObjectURL(originalImage.url);
      }
    },
    [originalImage]
  );

  const handleImageLoaded = useCallback((image: LoadedImage) => {
    setOriginalImage((previous) => {
      if (previous && previous.url !== image.url) {
        URL.revokeObjectURL(previous.url);
      }
      return image;
    });
    setMaskBlob(null);
    setEditedBlob(null);
    clearErrors();
    setRequestState("idle");
    lastPayloadRef.current = null;
  }, [clearErrors]);

  const handleMaskChange = useCallback((update: MaskUpdate | null) => {
    if (!update) {
      setMaskBlob(null);
      return;
    }

    setMaskBlob(update.blob);
    clearErrors();
  }, [clearErrors]);

  const editedFileName = useMemo(() => {
    if (!originalImage?.name) {
      return "edited-image.png";
    }

    const dotIndex = originalImage.name.lastIndexOf(".");
    if (dotIndex <= 0) {
      return `${originalImage.name}-edited.png`;
    }

    const base = originalImage.name.slice(0, dotIndex);
    const extension = originalImage.name.slice(dotIndex + 1) || "png";
    return `${base}-edited.${extension}`;
  }, [originalImage]);

  const handleGenerate = useCallback(async () => {
    if (!originalImage) {
      return;
    }

    if (!maskBlob) {
      setErrorKey("errors.noMask");
      setErrorOverride(null);
      return;
    }

    const payload: EditPayload = {
      original: originalImage.blob,
      mask: maskBlob,
      prompt: DEFAULT_PROMPT,
      modelId,
    };

    try {
      setRequestState("loading");
      clearErrors();
      const blob = await imageService.editImage(payload);
      setEditedBlob(blob);
      lastPayloadRef.current = { ...payload };
      setRequestState("idle");
    } catch (error) {
      console.error("Failed to generate edit", error);
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setErrorKey("errors.quota");
        setErrorOverride(null);
      } else {
        const serverMessage =
          axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
            ? error.response.data.error
            : null;
        if (serverMessage) {
          setErrorOverride(serverMessage);
          setErrorKey(null);
        } else {
          setErrorKey("errors.generic");
          setErrorOverride(null);
        }
      }
      setRequestState("error");
    }
  }, [clearErrors, imageService, maskBlob, modelId, originalImage]);

  const handleRegenerate = useCallback(async () => {
    const payload = lastPayloadRef.current;
    if (!payload) {
      return;
    }

    const payloadToSend: RegeneratePayload = {
      ...payload,
      modelId,
    };

    try {
      setRequestState("loading");
      clearErrors();
      const blob = await imageService.regenerate(payloadToSend);
      setEditedBlob(blob);
      lastPayloadRef.current = payloadToSend;
      setRequestState("idle");
    } catch (error) {
      console.error("Failed to regenerate edit", error);
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setErrorKey("errors.quota");
        setErrorOverride(null);
      } else {
        const serverMessage =
          axios.isAxiosError(error) && typeof error.response?.data?.error === "string"
            ? error.response.data.error
            : null;
        if (serverMessage) {
          setErrorOverride(serverMessage);
          setErrorKey(null);
        } else {
          setErrorKey("errors.generic");
          setErrorOverride(null);
        }
      }
      setRequestState("error");
    }
  }, [clearErrors, imageService, modelId]);

  const isLoading = requestState === "loading";
  const errorMessage = errorOverride ?? (errorKey ? t(errorKey) : null);

  return (
    <main className="image-fix-page">
      <header className="image-fix-page__header">
        <div className="image-fix-page__header-top">
          <h1>{t("header.title")}</h1>
          <LanguageSwitcher />
        </div>
        <p>{t("header.subtitle")}</p>
      </header>
      <div className="image-fix-page__content">
        <div className="image-fix-page__column image-fix-page__column--left">
          <MaskCanvas
            key={originalImage?.url ?? "no-image"}
            image={originalImage}
            onImageSelected={handleImageLoaded}
            onMaskChange={handleMaskChange}
            disabled={isLoading}
          />
        </div>
        <div className="image-fix-page__column image-fix-page__column--right">
          <EditControls
            modelId={modelId}
            onModelChange={setModelId}
            onGenerate={handleGenerate}
            onRegenerate={handleRegenerate}
            canGenerate={Boolean(originalImage) && !isLoading}
            canRegenerate={Boolean(lastPayloadRef.current)}
            isLoading={isLoading}
            error={errorMessage}
          />
          <ResultPreview
            original={originalImage}
            editedUrl={editedUrl}
            editedFileName={editedFileName}
            isLoading={isLoading}
          />
        </div>
      </div>
    </main>
  );
}
