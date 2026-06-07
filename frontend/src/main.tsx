import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/toast";
import App from "./App";
import { I18nProvider } from "./lib/i18n/I18nProvider";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  </StrictMode>,
);
