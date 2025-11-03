import { useCallback, useEffect, useState } from "react";
import type { LoadedImage } from "@types";
import { useTranslation } from "@i18n/TranslationProvider";

import "@styles/components/_preview.scss";

type ResultPreviewProps = {
  original: LoadedImage | null;
  editedUrl: string | null;
  editedFileName: string;
  isLoading: boolean;
};

export function ResultPreview({ original, editedUrl, editedFileName, isLoading }: ResultPreviewProps) {
  const [isModalOpen, setModalOpen] = useState(false);
  const { t } = useTranslation();

  const handleOpenModal = useCallback(() => {
    if (editedUrl) {
      setModalOpen(true);
    }
  }, [editedUrl]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!editedUrl) {
      setModalOpen(false);
    }
  }, [editedUrl]);

  return (
    <section className="result-preview">
      <header className="result-preview__header">
        <h2>{t("result.title")}</h2>
      </header>
      <div className="result-preview__grid">
        <figure className="result-preview__figure">
          {original ? (
            <>
              <img src={original.url} alt={original.name} />
              <figcaption>{t("result.original")}</figcaption>
            </>
          ) : (
            <span className="result-preview__placeholder">{t("result.placeholderEmpty")}</span>
          )}
        </figure>
        <figure className="result-preview__figure result-preview__figure--edited">
          {editedUrl ? (
            <>
              <div className="result-preview__image-wrapper">
                <img
                  src={editedUrl}
                  alt="Edited result"
                  onClick={handleOpenModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenModal();
                    }
                  }}
                />
              </div>
              <figcaption>{t("result.edited")}</figcaption>
              <div className="result-preview__actions">
                <button type="button" onClick={handleOpenModal}>
                  {t("result.zoom")}
                </button>
                <a
                  className="result-preview__download"
                  href={editedUrl}
                  download={editedFileName}
                  onClick={(event) => {
                    if (isLoading) {
                      event.preventDefault();
                    }
                  }}
                  aria-disabled={isLoading}
                >
                  {t("result.download")}
                </a>
              </div>
            </>
          ) : (
            <span className="result-preview__placeholder">
              {isLoading ? t("result.placeholderProcessing") : t("result.placeholderEmpty")}
            </span>
          )}
        </figure>
      </div>

      {isModalOpen && editedUrl ? (
        <div className="result-preview__modal" role="dialog" aria-modal="true" onClick={handleCloseModal}>
          <div
            className="result-preview__modal-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="result-preview__modal-close"
              onClick={handleCloseModal}
              aria-label={t("result.modalClose")}
            >
              ×
            </button>
            <img src={editedUrl} alt={t("result.edited")} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
