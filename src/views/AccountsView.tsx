import {
  CheckCircle,
  LogIn,
  OctagonX,
  Plus,
  RotateCcw,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import Checkbox from "../components/Checkbox";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import MinecraftSkinViewer, {
  type MinecraftSkinAnimation,
} from "../components/MinecraftSkinViewer";
import RadioButton from "../components/RadioButton";
import Spin from "../components/Spin";
import TabBar from "../components/TabBar";
import TabButton from "../components/TabButton";
import {
  authenticateMicrosoftAccount,
  getMicrosoftAccountTokenExpiry,
} from "../core/auth";
import { getSkin } from "../core/skin";
import { AppContext } from "../store";
import type { MinecraftAccount, MinecraftAccountCategory } from "../store/data";
import AccountEditorView from "./AccountEditorView";

type SkinViewerState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      capeError?: string;
      capeObjectUrl?: string;
      model: "default" | "slim";
      objectUrl: string;
    }
  | { status: "error"; message: string };

type SkinDisplayMode = "3d" | "2d";

const defaultSkinZoom = 0.8;
const maximumSkinZoom = 1.2;
const minimumSkinZoom = 0.5;

function clampSkinZoom(zoom: number) {
  return Math.min(maximumSkinZoom, Math.max(minimumSkinZoom, zoom));
}

function showMinecraftAccountCategory(category: MinecraftAccountCategory) {
  return {
    microsoft: "Microsoft",
    offline: "Offline",
    custom: "Custom",
  }[category];
}

function normalizeMinecraftUuid(uuid: string) {
  return uuid.replace(/-/g, "").toLowerCase();
}

export default function AccountsView() {
  const app = useContext(AppContext);
  const data = app.getData();
  const dataRef = useRef(data);
  dataRef.current = data;

  const current = data.accounts.find((account) => account.checked);
  const [showing, setShowing] = useState<"list" | "create">("list");
  const [option, setOption] = useState<"general" | "skin">("general");
  const [notAfter, setNotAfter] = useState<[string, Date | null] | undefined>();
  const [authenticatingAccountId, setAuthenticatingAccountId] = useState<
    string | null
  >(null);

  const onBackToList = () => setShowing("list");

  const onCheckAvailability = () => {
    if (current) {
      setNotAfter([current.id, getMicrosoftAccountTokenExpiry(current)]);
    }
  };

  const authenticateAgain = async (accountId: string, originalUuid: string) => {
    setAuthenticatingAccountId(accountId);
    try {
      const authenticatedAccount = await authenticateMicrosoftAccount();
      if (!authenticatedAccount) return;

      if (
        normalizeMinecraftUuid(authenticatedAccount.uuid) !==
        normalizeMinecraftUuid(originalUuid)
      ) {
        throw new Error(
          "The signed-in Microsoft account does not match the original account.",
        );
      }

      const target = dataRef.current.accounts.find(
        (account) => account.id === accountId,
      );
      if (!target) {
        throw new Error("The account no longer exists.");
      }

      app.setData((prevData) => {
        const account = prevData.accounts.find((item) => item.id === accountId);
        if (!account) return;

        account.username = authenticatedAccount.username;
        account.uuid = authenticatedAccount.uuid;
        account.xblToken = authenticatedAccount.xblToken;
        account.xblNotAfter = authenticatedAccount.xblNotAfter;
        account.userHash = authenticatedAccount.userHash;
        account.accessToken = authenticatedAccount.accessToken;
      });
      setNotAfter([accountId, new Date(authenticatedAccount.xblNotAfter)]);
    } catch (err) {
      app.openDialog({
        title: "Re-login Failed",
        message: `Failed to re-login Microsoft account:\n${err}`,
      });
    } finally {
      setAuthenticatingAccountId(null);
    }
  };

  const onRelogin = () => {
    if (current?.category !== "microsoft") return;

    if (!current.uuid) {
      app.openDialog({
        title: "Re-login Failed",
        message:
          "Unable to verify the Microsoft account because its original UUID is missing.",
      });
      return;
    }

    const accountId = current.id;
    const originalUuid = current.uuid;
    const expiry = getMicrosoftAccountTokenExpiry(current);
    setNotAfter([accountId, expiry]);

    const startAuthentication = () => {
      void authenticateAgain(accountId, originalUuid);
    };

    if (expiry && expiry > new Date()) {
      app.openDialog({
        title: "Re-login",
        message:
          "The token is still valid. You only need to re-login after it expires. Are you sure you want to re-login?",
        action: startAuthentication,
        actionMessage: "Re-login",
      });
      return;
    }

    startAuthentication();
  };

  const onDelete = () => {
    if (!current) return;

    app.openDialog({
      title: "Delete Account",
      message: `Are you sure you want to delete the account '${current.username}'? This action cannot be undone.`,
      action: () => {
        app.setData((prevData) => {
          prevData.accounts = prevData.accounts.filter(
            (account) => account.id !== current.id,
          );
        });
      },
      danger: true,
      actionMessage: "Delete",
    });
  };

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1">
        <div className="flex justify-center">
          <IconButton onClick={() => setShowing("create")}>
            <Plus />
          </IconButton>
        </div>
        {data.accounts.map((account) => (
          <ListItem
            checked={account.checked}
            key={account.id}
            onClick={() => {
              setOption("general");
              app.setData((prevData) => {
                const target = prevData.accounts.find(
                  (item) => item.id === account.id,
                );
                const former = target?.checked;
                prevData.accounts.forEach((acc) => {
                  acc.checked = false;
                });
                if (!former && target) target.checked = true;
              });
            }}
          >
            {account.category === "microsoft" && (
              <img
                width={24}
                src={`https://minotar.net/avatar/${account.uuid}`}
                alt="avatar"
              />
            )}
            <div>{account.username}</div>
          </ListItem>
        ))}
      </div>
      <div className="w-4/5 overflow-auto">
        {showing === "create" && <AccountEditorView onBack={onBackToList} />}
        {showing === "list" &&
          (current ? (
            <div>
              <TabBar ariaLabel="Account details">
                <TabButton
                  active={option === "general"}
                  ariaControls="account-general-panel"
                  id="account-general-tab"
                  onClick={() => setOption("general")}
                >
                  General
                </TabButton>
                <TabButton
                  active={option === "skin"}
                  ariaControls="account-skin-panel"
                  id="account-skin-tab"
                  onClick={() => setOption("skin")}
                >
                  Skin
                </TabButton>
              </TabBar>
              {option === "general" ? (
                <div
                  aria-labelledby="account-general-tab"
                  className="space-y-2 p-4"
                  id="account-general-panel"
                  role="tabpanel"
                >
                  <Label title="Username">{current.username}</Label>
                  <Label title="Category">
                    {showMinecraftAccountCategory(current.category)}
                  </Label>
                  <Label title="Created at">
                    {new Date(current.timestamp).toLocaleString()}
                  </Label>
                  {current.category === "microsoft" && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-4">
                        <Button onClick={onCheckAvailability}>
                          <ShieldCheck size={16} />
                          <div>Check availability</div>
                        </Button>
                        {notAfter?.[0] === current.id && (
                          <Fragment>
                            {notAfter[1] === null && (
                              <div>Unable to check availability.</div>
                            )}
                            {notAfter[1] &&
                              (notAfter[1] > new Date() ? (
                                <div className="flex items-center space-x-2">
                                  <CheckCircle size={16} />
                                  <div>Your token is available until</div>
                                  <div>{notAfter[1].toLocaleString()}</div>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <OctagonX size={16} />
                                  <div>Your token has expired at</div>
                                  <div>{notAfter[1].toLocaleString()}</div>
                                </div>
                              ))}
                          </Fragment>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        If the token is unavailable, use Re-login to make it
                        available again.
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={authenticatingAccountId !== null}
                          onClick={onRelogin}
                        >
                          <LogIn size={16} />
                          <div>Re-login</div>
                        </Button>
                        {authenticatingAccountId === current.id && <Spin />}
                      </div>
                    </div>
                  )}
                  <Button onClick={onDelete} danger>
                    Delete
                  </Button>
                </div>
              ) : (
                <div
                  aria-labelledby="account-skin-tab"
                  id="account-skin-panel"
                  role="tabpanel"
                >
                  {current.category === "microsoft" ? (
                    <AccountSkinViewer account={current} key={current.id} />
                  ) : (
                    <Center className="h-64">
                      Skin preview is only available for Microsoft accounts.
                    </Center>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Center className="h-full">
              Choose an account on the list to view details.
            </Center>
          ))}
      </div>
    </div>
  );
}

function AccountSkinViewer(props: { account: MinecraftAccount }) {
  const [animation, setAnimation] = useState<MinecraftSkinAnimation>("none");
  const [autoRotate, setAutoRotate] = useState(false);
  const [capeRenderError, setCapeRenderError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<SkinDisplayMode>("3d");
  const [resetVersion, setResetVersion] = useState(0);
  const [showCape, setShowCape] = useState(true);
  const [state, setState] = useState<SkinViewerState>({ status: "idle" });
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(defaultSkinZoom);
  const mountedRef = useRef(true);
  const objectUrlsRef = useRef<string[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
    };
  }, []);

  const onViewerError = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setViewerError(message);
  }, []);

  const onCapeError = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setCapeRenderError(message);
  }, []);

  const loadSkin = async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    objectUrlsRef.current.forEach(URL.revokeObjectURL);
    objectUrlsRef.current = [];
    setCapeRenderError(null);
    setViewerError(null);
    setState({ status: "loading" });

    try {
      const texture = await getSkin(props.account);
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      const buffer = Uint8Array.from(texture.bytes).buffer;
      const objectUrl = URL.createObjectURL(
        new Blob([buffer], { type: "image/png" }),
      );
      const capeObjectUrl = texture.capeBytes
        ? URL.createObjectURL(
            new Blob([Uint8Array.from(texture.capeBytes).buffer], {
              type: "image/png",
            }),
          )
        : undefined;
      const objectUrls = capeObjectUrl
        ? [objectUrl, capeObjectUrl]
        : [objectUrl];
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        objectUrls.forEach(URL.revokeObjectURL);
        return;
      }

      objectUrlsRef.current = objectUrls;
      setState({
        status: "ready",
        capeError: texture.capeError,
        capeObjectUrl,
        model: texture.model,
        objectUrl,
      });
    } catch (err) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      setState({
        status: "error",
        message: `Unable to load the Minecraft skin: ${err}`,
      });
    }
  };

  return (
    <div className="py-3 px-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            disabled={state.status === "loading"}
            onClick={() => {
              void loadSkin();
            }}
          >
            {state.status === "ready" ? "Reload Skin" : "View Skin"}
          </Button>
          {state.status === "loading" && <Spin />}
        </div>
        {state.status !== "idle" && (
          <Label horizontal title="Display mode">
            <div
              aria-label="Skin display mode"
              className="flex items-center gap-4"
              role="radiogroup"
            >
              <RadioButton
                checked={displayMode === "3d"}
                name="skin-display-mode"
                onClick={() => {
                  setCapeRenderError(null);
                  setViewerError(null);
                  setDisplayMode("3d");
                }}
                value="3d"
              >
                3D
              </RadioButton>
              <RadioButton
                checked={displayMode === "2d"}
                name="skin-display-mode"
                onClick={() => setDisplayMode("2d")}
                value="2d"
              >
                2D
              </RadioButton>
            </div>
          </Label>
        )}
        {state.status === "ready" && displayMode === "3d" && (
          <div className="max-w-sm space-y-2 rounded-lg border border-gray-300 p-2 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox checked={autoRotate} onChange={setAutoRotate}>
                Auto rotate
              </Checkbox>
              <Checkbox
                checked={showCape}
                disabled={!state.capeObjectUrl}
                onChange={setShowCape}
              >
                Show cape
              </Checkbox>
              <label className="flex items-center gap-2 text-sm font-medium">
                <span>Animation</span>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
                  onChange={(event) =>
                    setAnimation(
                      event.currentTarget.value as MinecraftSkinAnimation,
                    )
                  }
                  value={animation}
                >
                  <option value="none">None</option>
                  <option value="idle">Idle</option>
                  <option value="walk">Walk</option>
                  <option value="run">Run</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                ariaLabel="Zoom out"
                onClick={() =>
                  setZoom((currentZoom) => clampSkinZoom(currentZoom - 0.1))
                }
                small
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </IconButton>
              <div className="min-w-10 text-center text-xs font-medium">
                {Math.round(zoom * 100)}%
              </div>
              <IconButton
                ariaLabel="Zoom in"
                onClick={() =>
                  setZoom((currentZoom) => clampSkinZoom(currentZoom + 0.1))
                }
                small
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </IconButton>
              <IconButton
                ariaLabel="Reset view"
                onClick={() => {
                  setAutoRotate(false);
                  setZoom(defaultSkinZoom);
                  setResetVersion((version) => version + 1);
                }}
                small
                title="Reset view"
              >
                <RotateCcw size={16} />
              </IconButton>
            </div>
            {!state.capeObjectUrl && !state.capeError && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                This account does not have an official cape.
              </div>
            )}
          </div>
        )}
        {state.status === "error" && (
          <div
            className="text-sm text-red-600 dark:text-red-400 wrap-break-word"
            role="alert"
          >
            {state.message}
          </div>
        )}
        {state.status === "ready" && (
          <>
            <div className="h-80 max-w-sm overflow-hidden rounded-lg border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
              {displayMode === "3d" ? (
                <MinecraftSkinViewer
                  animation={animation}
                  autoRotate={autoRotate}
                  capeUrl={state.capeObjectUrl}
                  model={state.model}
                  onCapeError={onCapeError}
                  onError={onViewerError}
                  resetVersion={resetVersion}
                  showCape={showCape}
                  skinUrl={state.objectUrl}
                  zoom={zoom}
                />
              ) : (
                <div className="flex h-full flex-wrap items-center justify-center gap-6 overflow-auto p-4">
                  <figure className="space-y-1 text-center">
                    <img
                      alt="Minecraft skin texture"
                      className="w-48 max-w-full [image-rendering:pixelated]"
                      src={state.objectUrl}
                    />
                    <figcaption className="text-xs text-gray-500 dark:text-gray-400">
                      Skin
                    </figcaption>
                  </figure>
                  {state.capeObjectUrl && (
                    <figure className="space-y-1 text-center">
                      <img
                        alt="Minecraft cape texture"
                        className="w-32 max-w-full [image-rendering:pixelated]"
                        src={state.capeObjectUrl}
                      />
                      <figcaption className="text-xs text-gray-500 dark:text-gray-400">
                        Cape
                      </figcaption>
                    </figure>
                  )}
                </div>
              )}
            </div>
            {displayMode === "3d" && viewerError && (
              <div
                className="text-sm text-red-600 dark:text-red-400 wrap-break-word"
                role="alert"
              >
                {viewerError}
              </div>
            )}
            {state.capeError && (
              <div
                className="text-sm text-amber-600 dark:text-amber-400 wrap-break-word"
                role="status"
              >
                Unable to load the Minecraft cape: {state.capeError}
              </div>
            )}
            {displayMode === "3d" && showCape && capeRenderError && (
              <div
                className="text-sm text-amber-600 dark:text-amber-400 wrap-break-word"
                role="status"
              >
                {capeRenderError}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {displayMode === "3d"
                ? "Drag the preview to rotate the player."
                : state.capeObjectUrl
                  ? "The images show the original Minecraft skin and cape textures."
                  : "The image shows the original Minecraft skin texture."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
