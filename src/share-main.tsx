import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import { ViewerApp } from "@/app/viewer-app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>,
);
