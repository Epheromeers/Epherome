import { useMemo, useState } from "react";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";

export default function App() {
  const [view, setView] = useState("dashboard");
  const views = useMemo(
    () =>
      [
        ["dashboard", "Dashboard", DashboardView],
        ["accounts", "Accounts", AccountsView],
        ["instances", "Instances", InstancesView],
        ["settings", "Settings", SettingsView],
      ] as [string, string, React.ComponentType][],
    [],
  );

  return (
    <div className="flex h-screen">
      <div className="w-1/6 p-2 border-r border-gray-300 space-y-1">
        {views.map(([key, label]) => (
          <button
            key={key}
            className={`block text-sm px-2 py-1 rounded w-full text-left ${view === key ? "bg-gray-200" : "hover:bg-gray-100 active:bg-gray-200"}`}
            type="button"
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="w-5/6 p-2">
        {views.map(([key, , TheView]) => view === key && <TheView />)}
      </div>
    </div>
  );
}
