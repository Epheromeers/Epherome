import { CircleUser, Cog, Grid2X2Check, LayoutDashboard } from "lucide-react";
import { useMemo, useState } from "react";
import { AppContext } from "./store";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";

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
    <div className="flex h-screen overflow-hidden">
      <div className="p-2 border-r border-gray-300 space-y-1">
        {views.map(
          ([key, , TheIcon]) =>
            TheIcon && (
              <button
                key={key}
                className={`block rounded p-2 ${view === key ? "bg-gray-100" : "hover:bg-gray-100 active:bg-gray-200"}`}
                type="button"
                onClick={() => setView(key)}
              >
                <TheIcon />
              </button>
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
