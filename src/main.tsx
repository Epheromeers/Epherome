import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { configStore } from "./config";
import { applyTheme } from "./config/theme";

async function initialize() {
  const options = { baseDir: BaseDirectory.AppData };
  await mkdir("", { ...options, recursive: true });
  if (!(await exists("epherome.json", options))) {
    await writeTextFile(
      "epherome.json",
      JSON.stringify(configStore.data),
      options,
    );
  } else {
    const originalData = configStore.data;
    const data = await readTextFile("epherome.json", options);
    configStore.data = { ...originalData, ...JSON.parse(data) };
  }
  applyTheme();
}

initialize().then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
