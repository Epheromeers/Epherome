import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureDataDir, readUserData } from "./store/data";

async function initialize() {
  await ensureDataDir();
  return await readUserData();
}

initialize().then((userData) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App userData={userData} />
    </React.StrictMode>,
  );
});
