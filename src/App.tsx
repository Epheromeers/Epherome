import { CircleUser, Cog, Grid2X2Check, LayoutDashboard } from "lucide-react";
import { useMemo, useState } from "react";
import { AppContext } from "./store";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";
import IconButton from "./components/IconButton";

export default function App() {
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

  return (
    <div className="flex h-screen overflow-hidden dark:bg-gray-800 dark:text-white">
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
        }}
      >
        <div className="grow overflow-auto">
          {views.map(([key, TheView]) => view === key && <TheView key={key} />)}
        </div>
      </AppContext>
    </div>
  );
}
