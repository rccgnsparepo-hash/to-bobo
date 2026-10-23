import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerAppSW } from "./pwa/registerSW";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA service-worker registration (production only, guarded against previews).
void registerAppSW();