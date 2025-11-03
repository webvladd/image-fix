import { useTranslation } from "@i18n/TranslationProvider";
import type { ModelId } from "@types";

import "@styles/components/_controls.scss";

type EditControlsProps = {
  modelId: ModelId;
  onModelChange: (model: ModelId) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  canGenerate: boolean;
  canRegenerate: boolean;
  isLoading: boolean;
  error?: string | null;
};

export function EditControls({
  modelId,
  onModelChange,
  onGenerate,
  onRegenerate,
  canGenerate,
  canRegenerate,
  isLoading,
  error,
}: EditControlsProps) {
  const { t } = useTranslation();

  return (
    <section className="edit-controls">
      <header className="edit-controls__header">
        <h2>{t("controls.title")}</h2>
        <p>{t("controls.subtitle")}</p>
      </header>

      <label className="edit-controls__label" htmlFor="edit-model">
        {t("controls.modelLabel")}
      </label>
      <div className="edit-controls__select-wrapper">
        <select
          id="edit-model"
          className="edit-controls__select"
          value={modelId}
          onChange={(event) => onModelChange(event.target.value as ModelId)}
          disabled={isLoading}
        >
          <option value="cleanup-pictures">{t("controls.provider.cleanup")}</option>
          <option value="lightx">{t("controls.provider.lightx")}</option>
        </select>
      </div>

      {error ? <p className="edit-controls__error">{error}</p> : null}

      <div className="edit-controls__actions">
        <button type="button" onClick={onGenerate} disabled={!canGenerate || isLoading}>
          {isLoading ? t("controls.generating") : t("controls.generate")}
        </button>
        <button type="button" onClick={onRegenerate} disabled={!canRegenerate || isLoading}>
          {t("controls.regenerate")}
        </button>
      </div>
    </section>
  );
}
