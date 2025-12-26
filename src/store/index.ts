import { createContext } from "react";
import { fallbackUserData, type UserData } from "./data";

export const errorList: string[] = [];

export interface DialogOptions {
  title: string;
  message: string;
  action?: () => void;
  danger?: boolean;
  actionMessage?: string;
}

export interface AppContextType {
  setView: (viewName: string) => void;
  getView: () => string;
  setLaunchMessage: (message: string | undefined) => void;
  getLaunchMessage: () => string | undefined;
  openDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
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
  getData: () => fallbackUserData,
  setData: () => {},
});
