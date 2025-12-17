import { createContext } from "react";

type LaunchMessage = string | undefined;

interface AppContextType {
  setView: (viewName: string) => void;
  getView: () => string;
  setLaunchMessage: (message: LaunchMessage) => void;
  getLaunchMessage: () => LaunchMessage;
}

export const AppContext = createContext<AppContextType>({
  setView: () => {},
  getView: () => "not implemented",
  setLaunchMessage: () => {},
  getLaunchMessage: () => "not implemented",
});
