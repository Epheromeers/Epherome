import { createContext } from "react";
import { fallbackUserData, type UserData } from "./data";
import type { DialogOptions, ToastOptions } from "./status";

export interface AppContextType {
  setView: (viewName: string) => void;
  getView: () => string;
  setLaunchMessage: (message: string | undefined) => void;
  getLaunchMessage: () => string | undefined;
  openDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
  openToast: (options: ToastOptions) => void;
  closeToast: () => void;
  getData: () => UserData;
  setData: (updater: (prevData: UserData) => void) => void;
}

export const AppContext = createContext<AppContextType>({
  setView: () => {},
  getView: () => "not implemented",
  setLaunchMessage: () => {},
  getLaunchMessage: () => "not implemented",
  openDialog: () => {},
  closeDialog: () => {},
  openToast: () => {},
  closeToast: () => {},
  getData: () => fallbackUserData,
  setData: () => {},
});
