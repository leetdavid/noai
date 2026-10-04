import { createRoot } from "react-dom/client";

import { HomeApp } from "./home";
import { MaintainApp } from "./maintain";
import { SubmitApp } from "./submit";
import "./styles.css";
import "./workflows.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("NoAI web root is missing");
}

const path = window.location.pathname.replace(/\/+$/, "") || "/";
createRoot(root).render(
  path === "/maintain" ? (
    <MaintainApp />
  ) : path === "/submit" ? (
    <SubmitApp />
  ) : (
    <HomeApp />
  ),
);
