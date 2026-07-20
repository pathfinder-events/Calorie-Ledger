import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Android PWAs sometimes restore the zoom/scroll state from the previous
// session on reopen, showing zoomed-out even though the page itself
// renders at 100%. This forces a re-read of the viewport meta tag
// shortly after load, which nudges Chrome to recompute the scale fresh
// rather than restoring a stale one.
function resetZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const content = meta.getAttribute("content");
  meta.setAttribute("content", content + ", " + Date.now());
  requestAnimationFrame(() => {
    meta.setAttribute("content", content);
  });
  window.scrollTo(0, 0);
}

window.addEventListener("load", () => setTimeout(resetZoom, 200));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resetZoom();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
