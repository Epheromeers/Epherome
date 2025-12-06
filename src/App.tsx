import { useMemo, useState } from "react";
import { RouterContext } from "./router";
import AccountEditorView from "./views/AccountEditorView";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";

export default function App() {
  const [view, setView] = useState("dashboard");
  const views = useMemo(
    () =>
      [
        ["dashboard", DashboardView, "Dashboard"],
        ["accounts", AccountsView, "Accounts"],
        ["instances", InstancesView, "Instances"],
        ["settings", SettingsView, "Settings"],
        ["accountEditor", AccountEditorView],
      ] as [string, React.ComponentType, string?][],
    [],
  );

  return (
    <div className="flex h-screen">
      <div className="w-1/6 p-2 border-r border-gray-300 space-y-1">
        {views.map(
          ([key, , label]) =>
            label && (
              <button
                key={key}
                className={`block text-sm px-2 py-1 rounded-lg w-full text-left ${view === key ? "bg-gray-200" : "hover:bg-gray-100 active:bg-gray-200"}`}
                type="button"
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ),
        )}
      </div>
      <RouterContext
        value={{
          setView: (viewName: string) => {
            setView(viewName);
          },
          getView: () => view,
        }}
      >
        <div className="w-5/6 p-2">
          {views.map(([key, TheView]) => view === key && <TheView key={key} />)}
        </div>
      </RouterContext>
    </div>
  );
}
