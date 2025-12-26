import type { ColorTheme } from "./data";

const media = window.matchMedia("(prefers-color-scheme: dark)");
const rootElement = document.getElementById("root") as HTMLElement;

const listener = () => {
  const systemTheme = media.matches ? "dark" : "light";
  rootElement.setAttribute("data-theme", systemTheme);
};

export function updateTheme(theme: ColorTheme) {
  const systemTheme = media.matches ? "dark" : "light";
  rootElement.setAttribute(
    "data-theme",
    theme === "system" ? systemTheme : theme,
  );

  if (theme === "system") {
    media.addEventListener("change", listener);
  } else {
    media.removeEventListener("change", listener);
  }
}
