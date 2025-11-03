import { useTranslation } from "@i18n/TranslationProvider";
import { type Language } from "@i18n/translations";

import "@styles/components/_languageSwitcher.scss";

const LANGUAGE_OPTIONS: Language[] = ["uk", "en"];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className="language-switcher">
      <label className="language-switcher__label" htmlFor="language-select">
        {t("switcher.label")}
      </label>
      <select
        id="language-select"
        className="language-switcher__select"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(option === "uk" ? "switcher.option.uk" : "switcher.option.en")}
          </option>
        ))}
      </select>
    </div>
  );
}
