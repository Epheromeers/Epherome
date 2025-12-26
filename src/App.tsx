import { CircleUser, Cog, Grid2X2Check, LayoutDashboard } from "lucide-react";
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

export default function App(props: { userData: UserData }) {
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
      ] as [string, React.ComponentType, React.ComponentType?][],
    [],
  );
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [data, setData] = useState<UserData>(props.userData);

  useEffect(() => {
    updateTheme(data.settings.theme);
  }, [data.settings.theme]);

  return (
    <div className="flex h-screen dark:bg-gray-800 dark:text-white overflow-hidden">
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
          {views.map(([key, TheView]) => view === key && <TheView key={key} />)}
        </div>
        {dialog && (
          <Fragment>
            <div className="absolute opacity-50 w-full h-full bg-gray-500 z-10" />
            <Dialog {...dialog} />
          </Fragment>
        )}
      </AppContext>
    </div>
  );
}
