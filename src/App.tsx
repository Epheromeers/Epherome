import { platform } from "@tauri-apps/plugin-os";
import {
  CircleUser,
  Cog,
  Grid2X2Check,
  LayoutDashboard,
  type LucideIcon,
  SquareActivity,
} from "lucide-react";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Dialog from "./components/Dialog";
import IconButton from "./components/IconButton";
import TitleBar from "./components/TitleBar";
import { AppContext, type AppContextType } from "./store";
import { type UserData, writeUserData } from "./store/data";
import type { AppStatus, DialogOptions } from "./store/status";
import { updateTheme } from "./store/theme";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import InstancesView from "./views/InstancesView";
import SettingsView from "./views/SettingsView";
import TaskManagerView from "./views/TaskManagerView";

const isMac = platform() === "macos";

interface ViewDefinition {
  key: string;
  title: string;
  View: ComponentType;
  Icon: LucideIcon;
}

const views = [
  {
    key: "dashboard",
    title: "Dashboard",
    View: DashboardView,
    Icon: LayoutDashboard,
  },
  { key: "accounts", title: "Accounts", View: AccountsView, Icon: CircleUser },
  {
    key: "instances",
    title: "Instances",
    View: InstancesView,
    Icon: Grid2X2Check,
  },
  { key: "settings", title: "Settings", View: SettingsView, Icon: Cog },
  { key: "tasks", title: "Tasks", View: TaskManagerView, Icon: SquareActivity },
] as const satisfies readonly ViewDefinition[];

type ViewKey = (typeof views)[number]["key"];

const viewByKey = views.reduce(
  (result, { key, View }) => {
    result[key] = View;
    return result;
  },
  {} as Record<ViewKey, ComponentType>,
);
const noJresDialog: DialogOptions = {
  title: "No Java Runtimes Detected",
  message:
    "Please install a Java Runtime if you haven't, and add it in the settings.",
};

function isViewKey(viewName: string): viewName is ViewKey {
  return views.some(({ key }) => key === viewName);
}

export default function App(props: { userData: UserData; noJres: boolean }) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [dialog, setDialog] = useState<DialogOptions | null>(
    props.noJres ? noJresDialog : null,
  );
  const [status, setStatus] = useState<AppStatus>({});
  const [userData, setUserData] = useState<UserData>(props.userData);
  const shouldPersistUserData = useRef(false);

  const setViewByName = useCallback((viewName: string) => {
    if (isViewKey(viewName)) {
      setView(viewName);
      return;
    }

    console.log(`Unknown view: ${viewName}`);
  }, []);

  const getView = useCallback(() => view, [view]);

  const setLaunchMessage = useCallback((message: string | undefined) => {
    setStatus((prev) => ({ ...prev, launchMessage: message }));
  }, []);

  const getLaunchMessage = useCallback(
    () => status.launchMessage,
    [status.launchMessage],
  );

  const openDialog = useCallback((options: DialogOptions) => {
    setDialog(options);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const getData = useCallback(() => userData, [userData]);

  const setData = useCallback((updater: (prevData: UserData) => void) => {
    shouldPersistUserData.current = true;

    setUserData((prevData) => {
      const newData = { ...prevData };
      updater(newData);
      return newData;
    });
  }, []);

  const contextValue: AppContextType = useMemo(
    () => ({
      setView: setViewByName,
      getView,
      setLaunchMessage,
      getLaunchMessage,
      openDialog,
      closeDialog,
      getData,
      setData,
    }),
    [
      closeDialog,
      getData,
      getLaunchMessage,
      getView,
      openDialog,
      setData,
      setLaunchMessage,
      setViewByName,
    ],
  );

  useEffect(() => {
    updateTheme(userData.settings.theme);
  }, [userData.settings.theme]);

  useEffect(() => {
    if (!shouldPersistUserData.current) {
      return;
    }

    shouldPersistUserData.current = false;

    writeUserData(userData).catch((err) => {
      setDialog({
        title: "Error",
        message: `Failed to save user data: ${err}`,
      });
    });
  }, [userData]);

  const ActiveView = viewByKey[view];

  return (
    <div className="h-screen flex flex-col">
      <TitleBar isMac={isMac} />
      <div className="flex grow dark:bg-gray-800 dark:text-white overflow-hidden">
        <SidebarNav currentView={view} onChangeView={setView} />
        <AppContext value={contextValue}>
          <div className="grow overflow-auto">
            <ActiveView />
          </div>
          <DialogLayer dialog={dialog} />
        </AppContext>
      </div>
    </div>
  );
}

function SidebarNav(props: {
  currentView: ViewKey;
  onChangeView: (view: ViewKey) => void;
}) {
  return (
    <div className="p-2 border-r border-gray-300 dark:border-gray-700 space-y-1">
      {views.map(({ key, title, Icon }) => (
        <IconButton
          active={props.currentView === key}
          key={key}
          onClick={() => props.onChangeView(key)}
          title={title}
        >
          <Icon />
        </IconButton>
      ))}
    </div>
  );
}

function DialogLayer(props: { dialog: DialogOptions | null }) {
  if (!props.dialog) {
    return null;
  }

  return (
    <>
      <div className="absolute opacity-50 w-full h-full bg-gray-500 z-10" />
      <Dialog {...props.dialog} />
    </>
  );
}
