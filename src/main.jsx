import React from "react";
import { createRoot } from "react-dom/client";
import McMatcherProduct from "./McMatcher.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <McMatcherProduct />
  </React.StrictMode>,
);
