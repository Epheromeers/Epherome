import { platform } from "@tauri-apps/plugin-os";
import {
  CircleUser,
  Cog,
  Grid2X2Check,
  LayoutDashboard,
  type LucideIcon,
  SquareActivity,
  Wrench,
} from "lucide-react";
import { nanoid } from "nanoid";
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
import Toast from "./components/Toast";
import { AppContext, type AppContextType } from "./store";
import { type UserData, writeUserData } from "./store/data";
import type { AppStatus, DialogOptions, ToastOptions } from "./store/status";
import { updateTheme } from "./store/theme";
import AccountsView from "./views/AccountsView";
import DashboardView from "./views/DashboardView";
import DeveloperToolsView from "./views/DeveloperToolsView";
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
  {
    key: "developerTools",
    title: "Developer Tools",
    View: DeveloperToolsView,
    Icon: Wrench,
  },
] as const satisfies readonly ViewDefinition[];

type ViewKey = (typeof views)[number]["key"];
type ActiveDialog = DialogOptions & { id: string };
type ActiveToast = ToastOptions & { id: string };

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
  const [dialog, setDialog] = useState<ActiveDialog | null>(() =>
    props.noJres ? { ...noJresDialog, id: nanoid() } : null,
  );
  const [toast, setToast] = useState<ActiveToast | null>(null);
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
    setDialog({ ...options, id: nanoid() });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const openToast = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: nanoid() });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const getData = useCallback(() => userData, [userData]);

  const setData = useCallback((updater: (prevData: UserData) => void) => {
    shouldPersistUserData.current = true;

    setUserData((prevData) => {
      const newData = structuredClone(prevData);
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
      openToast,
      closeToast,
      getData,
      setData,
    }),
    [
      closeDialog,
      closeToast,
      getData,
      getLaunchMessage,
      getView,
      openDialog,
      openToast,
      setData,
      setLaunchMessage,
      setViewByName,
    ],
  );

  useEffect(() => {
    if (!userData.settings.developerTools && view === "developerTools") {
      setView("dashboard");
    }
  }, [userData.settings.developerTools, view]);

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
        id: nanoid(),
        title: "Error",
        message: `Failed to save user data: ${err}`,
      });
    });
  }, [userData]);

  const ActiveView = viewByKey[view];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar isMac={isMac} />
      <div className="relative flex min-h-0 grow overflow-hidden dark:bg-gray-800 dark:text-white">
        <SidebarNav
          currentView={view}
          developerToolsEnabled={userData.settings.developerTools}
          onChangeView={setView}
        />
        <AppContext value={contextValue}>
          <div className="grow overflow-auto">
            <ActiveView />
          </div>
          <DialogLayer dialog={dialog} />
          <ToastLayer toast={toast} />
        </AppContext>
      </div>
    </div>
  );
}

function SidebarNav(props: {
  currentView: ViewKey;
  developerToolsEnabled: boolean;
  onChangeView: (view: ViewKey) => void;
}) {
  const visibleViews = views.filter(
    ({ key }) => key !== "developerTools" || props.developerToolsEnabled,
  );

  return (
    <div className="p-2 border-r border-gray-300 dark:border-gray-700 space-y-1">
      {visibleViews.map(({ key, title, Icon }) => (
        <IconButton
          active={props.currentView === key}
          key={key}
          onClick={() => props.onChangeView(key)}
          title={title}
          tooltipPlacement="right"
        >
          <Icon />
        </IconButton>
      ))}
    </div>
  );
}

function DialogLayer(props: { dialog: ActiveDialog | null }) {
  if (!props.dialog) {
    return null;
  }

  const { id, ...dialogOptions } = props.dialog;

  return (
    <>
      <div className="absolute inset-0 z-10 bg-gray-500/50" />
      <Dialog {...dialogOptions} key={id} />
    </>
  );
}

function ToastLayer(props: { toast: ActiveToast | null }) {
  if (!props.toast) {
    return null;
  }

  return (
    <Toast
      category={props.toast.category}
      content={props.toast.content}
      key={props.toast.id}
    />
  );
}
