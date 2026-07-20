import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Opts this page out of Chrome's back-forward cache (bfcache). Without
// this, Chrome can freeze the entire page -- including whatever zoom
// level it happened to be at -- and instantly restore that frozen
// snapshot on next open, instead of loading fresh. An "unload" listener
// is a standard (if unusual-looking) way to disable that caching for a
// specific page.
window.addEventListener("unload", () => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
