import { createContext } from "react";

type LaunchMessage = string | undefined;

export interface DialogOptions {
  title: string;
  message: string;
  action?: () => void;
  danger?: boolean;
  actionMessage?: string;
}

interface AppContextType {
  setView: (viewName: string) => void;
  getView: () => string;
  setLaunchMessage: (message: LaunchMessage) => void;
  getLaunchMessage: () => LaunchMessage;
  openDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
}

export const AppContext = createContext<AppContextType>({
  setView: () => {},
  getView: () => "not implemented",
  setLaunchMessage: () => {},
  getLaunchMessage: () => "not implemented",
  openDialog: () => {},
  closeDialog: () => {},
});
