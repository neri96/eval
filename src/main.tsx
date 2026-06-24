import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";

import { HashRouter } from "react-router-dom";
import App from "./app/App";

// HashRouter keeps routes in the URL hash, so the static bundle needs no
// server-side SPA fallback — deep links and refreshes work on any host and
// even when index.html is opened directly.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
