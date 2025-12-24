import { configStore } from ".";

const root = document.getElementById("root") as HTMLElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme() {
  const systemTheme = media.matches ? "dark" : "light";
  const theme = configStore.data.theme;
  root.setAttribute("data-theme", theme === "system" ? systemTheme : theme);
}

media.addEventListener("change", () => {
  if (configStore.data.theme === "system") {
    applyTheme();
  }
});
