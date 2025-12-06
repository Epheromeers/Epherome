import { createContext } from "react";

export interface RouterContextType {
  setView: (viewName: string) => void;
  getView: () => string;
}

export const RouterContext = createContext<RouterContextType>({
  setView: () => {
    /* not implemented */
  },
  getView: () => "not implemented",
});
