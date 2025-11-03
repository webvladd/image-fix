import React from "react";
import ReactDOM from "react-dom/client";
import ImageFixPage from "@pages/ImageFixPage";
import { TranslationProvider } from "@i18n/TranslationProvider";
import "@styles/globals.scss";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TranslationProvider>
      <ImageFixPage />
    </TranslationProvider>
  </React.StrictMode>
);
