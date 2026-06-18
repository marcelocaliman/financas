import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { TicketPublicPage } from "@/pages/ticket-public";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TicketPublicPage />
  </StrictMode>,
);
