import { configStore } from ".";

const root = document.getElementById("root") as HTMLElement;

export function applyTheme() {
  const theme = configStore.data.theme;
  root.setAttribute("data-theme", theme);
}
