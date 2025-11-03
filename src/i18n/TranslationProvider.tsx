import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type Language, type TranslationKey } from "./translations";

type TranslationContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

const STORAGE_KEY = "imagefix_language";
const DEFAULT_LANGUAGE: Language = "uk";

function resolveInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "uk") {
    return stored;
  }

  return DEFAULT_LANGUAGE;
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => resolveInitialLanguage());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  const setLanguage = useCallback((value: Language) => {
    updateLanguage(value);
  }, []);

  const value = useMemo<TranslationContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language][key] ?? key,
    }),
    [language, setLanguage]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within TranslationProvider");
  }
  return context;
}
