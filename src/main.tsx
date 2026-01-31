import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { listen } from "@tauri-apps/api/event";
import { detectJavas } from "./core/java";
import { errorList, type ProcessOutput, processOutputTable } from "./store";
import { ensureDataDir, readUserData } from "./store/data";
import { updateTheme } from "./store/theme";

async function initialize() {
  let noJres = false;

  await ensureDataDir();
  const userData = await readUserData();
  updateTheme(userData.settings.theme);

  if (
    !userData.settings.javaRuntimes ||
    userData.settings.javaRuntimes.length === 0
  ) {
    const rts = await detectJavas();
    userData.settings.javaRuntimes = rts;

    if (rts.length === 0) {
      noJres = true;
    }
  }

  return [userData, noJres];
}

window.addEventListener("error", (event) => {
  errorList.push(event.message);
});

listen("process-output", (event) => {
  const payload = event.payload as ProcessOutput;
  if (!processOutputTable[payload.nanoid]) {
    processOutputTable[payload.nanoid] = [];
  }
  processOutputTable[payload.nanoid].push(payload);
});

initialize().then(([userData, noJres]) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App userData={userData} noJres={noJres} />
    </React.StrictMode>,
  );
});
