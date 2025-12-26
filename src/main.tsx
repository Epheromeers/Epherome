import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureDataDir, readUserData } from "./store/data";
import { updateTheme } from "./store/theme";

async function initialize() {
  await ensureDataDir();
  const userData = await readUserData();
  updateTheme(userData.settings.theme);
  return userData;
}

initialize().then((userData) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App userData={userData} />
    </React.StrictMode>,
  );
});
