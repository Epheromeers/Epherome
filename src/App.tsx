import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import {
  CircleUser,
  Cog,
  Grid2X2Check,
  LayoutDashboard,
  Maximize,
  Minus,
  SquareActivity,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import Dialog from "./components/Dialog";
import IconButton from "./components/IconButton";
import { AppContext, type DialogOptions } from "./store";
import { type UserData, writeUserData } from "./store/data";
import { updateTheme } from "./store/theme";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";
import TaskManagerView from "./views/TaskManagerView";

const isMac = platform() === "macos";

const noJreDialog: DialogOptions = {
  title: "No Java Runtimes Detected",
  message:
    "Please install a Java Runtime if you haven't, and add it in the settings.",
};

function WindowControlIcon(props: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`flex items-center rounded-full p-2 hover:bg-gray-200/40`}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export default function App(props: { userData: UserData; noJres: boolean }) {
  const window = getCurrentWindow();
  const [view, setView] = useState("dashboard");
  const [launchMessage, setLaunchMessage] = useState<string | undefined>(
    undefined,
  );
  const views = useMemo(
    () =>
      [
        ["dashboard", DashboardView, LayoutDashboard],
        ["accounts", AccountsView, CircleUser],
        ["instances", InstancesView, Grid2X2Check],
        ["settings", SettingsView, Cog],
        ["tasks", TaskManagerView, SquareActivity],
      ] as [string, React.ComponentType, React.ComponentType?][],
    [],
  );
  const [dialog, setDialog] = useState<DialogOptions | null>(
    props.noJres ? noJreDialog : null,
  );
  const [data, setData] = useState<UserData>(props.userData);

  useEffect(() => {
    updateTheme(data.settings.theme);
  }, [data.settings.theme]);

  return (
    <div className="h-screen flex flex-col">
      <div
        className={`min-h-9 max-h-9 ${isMac ? "pl-24" : "pl-3"} flex text-white items-center border-b border-gray-300 dark:border-gray-700 bg-linear-to-r from-sky-600 to-pink-300`}
        data-tauri-drag-region
      >
        <div className="font-medium text-sm">Epherome</div>
        <div className="grow" />
        {!isMac && (
          <Fragment>
            <WindowControlIcon onClick={() => window.minimize()}>
              <Minus size={16} />
            </WindowControlIcon>
            <WindowControlIcon onClick={() => window.toggleMaximize()}>
              <Maximize size={16} />
            </WindowControlIcon>
            <WindowControlIcon onClick={() => window.close()}>
              <X size={16} />
            </WindowControlIcon>
          </Fragment>
        )}
      </div>
      <div className="flex grow dark:bg-gray-800 dark:text-white overflow-hidden">
        <div className="p-2 border-r border-gray-300 dark:border-gray-700 space-y-1">
          {views.map(
            ([key, , TheIcon]) =>
              TheIcon && (
                <IconButton
                  active={view === key}
                  key={key}
                  onClick={() => setView(key)}
                >
                  <TheIcon />
                </IconButton>
              ),
          )}
        </div>
        <AppContext
          value={{
            setView: (viewName: string) => {
              setView(viewName);
            },
            getView: () => view,
            setLaunchMessage: (message?: string | undefined) => {
              setLaunchMessage(message);
            },
            getLaunchMessage: () => launchMessage,
            openDialog: (options: DialogOptions) => {
              setDialog(options);
            },
            closeDialog: () => {
              setDialog(null);
            },
            getData: () => data,
            setData: (updater) => {
              const newData = { ...data };
              updater(newData);
              writeUserData(newData);
              setData(newData);
            },
          }}
        >
          <div className="grow overflow-auto">
            {views.map(
              ([key, TheView]) => view === key && <TheView key={key} />,
            )}
          </div>
          {dialog && (
            <Fragment>
              <div className="absolute opacity-50 w-full h-full bg-gray-500 z-10" />
              <Dialog {...dialog} />
            </Fragment>
          )}
        </AppContext>
      </div>
    </div>
  );
}
