import { path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import Checkbox from "../components/Checkbox";
import Input from "../components/Input";
import Spin from "../components/Spin";
import {
  importLocalMods,
  type LocalModDependency,
  type LocalModFile,
  type LocalModMetadataEntry,
  scanLocalMods,
  setLocalModEnabled,
} from "../core/mods";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";

const disabledSuffix = ".disabled";
const filenameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

interface ModRefreshResult {
  success: boolean;
  error?: string;
}

interface KeyedListItem<T> {
  key: string;
  value: T;
  index: number;
}

function displayFilename(filename: string): string {
  if (filename.toLowerCase().endsWith(disabledSuffix)) {
    return filename.slice(0, -disabledSuffix.length);
  }
  return filename;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatImportFailures(
  failed: { filename: string; reason: string }[],
): string {
  const visibleFailures = failed
    .slice(0, 5)
    .map(({ filename, reason }) => `${filename}: ${reason}`)
    .join("; ");
  const remaining = failed.length > 5 ? `; and ${failed.length - 5} more` : "";
  return `${visibleFailures}${remaining}`;
}

function declaredValue(value?: string): string {
  return value?.trim() || "Not declared";
}

function keyedList<T>(
  values: T[],
  getBaseKey: (value: T) => string,
): KeyedListItem<T>[] {
  const occurrences = new Map<string, number>();

  return values.map((value, index) => {
    const baseKey = getBaseKey(value) || "item";
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return {
      key: `${baseKey}-${occurrence}`,
      value,
      index,
    };
  });
}

function modDisplayName(mod: LocalModFile): string {
  const primaryEntry = mod.metadata.entries[0];
  return (
    primaryEntry?.name?.trim() ||
    primaryEntry?.modId?.trim() ||
    displayFilename(mod.filename)
  );
}

function modSummaryParts(mod: LocalModFile): string[] {
  const primaryEntry = mod.metadata.entries[0];
  const filename = displayFilename(mod.filename);
  const displayName = modDisplayName(mod);
  const parts = [];

  if (displayName !== filename) parts.push(filename);
  if (primaryEntry?.version?.trim()) parts.push(primaryEntry.version);
  if (primaryEntry?.loader.trim()) parts.push(primaryEntry.loader);
  parts.push(formatFileSize(mod.size));

  if (mod.metadata.entries.length > 1) {
    parts.push(`${mod.metadata.entries.length} metadata entries`);
  } else if (!primaryEntry) {
    parts.push("No supported metadata");
  }

  return parts;
}

function modSearchText(mod: LocalModFile): string {
  const metadataValues = mod.metadata.entries.flatMap((entry) => [
    entry.source,
    entry.loader,
    entry.name ?? "",
    entry.version ?? "",
    entry.modId ?? "",
    entry.loaderVersion ?? "",
    entry.languageLoader ?? "",
    entry.languageLoaderVersion ?? "",
    entry.gameVersion ?? "",
    entry.environment ?? "",
    ...entry.authors,
    ...entry.dependencies.flatMap((dependency) => [
      dependency.relation,
      dependency.modId,
      dependency.version ?? "",
      dependency.side ?? "",
      dependency.ordering ?? "",
    ]),
  ]);

  return [
    mod.filename,
    displayFilename(mod.filename),
    ...metadataValues,
    ...mod.metadata.diagnostics,
  ]
    .join("\n")
    .toLocaleLowerCase();
}

function MetadataField(props: {
  label: string;
  children: React.ReactNode;
  monospace?: boolean;
}) {
  return (
    <>
      <dt className="font-medium text-gray-600 dark:text-gray-300">
        {props.label}
      </dt>
      <dd
        className={`min-w-0 wrap-break-word ${props.monospace ? "font-mono" : ""}`}
      >
        {props.children}
      </dd>
    </>
  );
}

function DependencyList(props: { dependencies: LocalModDependency[] }) {
  if (props.dependencies.length === 0) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Not declared
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {keyedList(props.dependencies, (dependency) =>
        JSON.stringify(dependency),
      ).map(({ key, value: dependency }) => {
        const qualifiers = [
          dependency.version?.trim(),
          dependency.required === undefined
            ? undefined
            : `required: ${dependency.required ? "yes" : "no"}`,
          dependency.side?.trim()
            ? `side: ${dependency.side.trim()}`
            : undefined,
          dependency.ordering?.trim()
            ? `ordering: ${dependency.ordering.trim()}`
            : undefined,
        ].filter((value): value is string => Boolean(value));

        return (
          <li
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            key={key}
          >
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {dependency.relation}
            </span>
            <span className="wrap-break-word font-mono">
              {dependency.modId}
            </span>
            {qualifiers.length > 0 && (
              <span className="wrap-break-word text-gray-500 dark:text-gray-400">
                {qualifiers.join(" · ")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MetadataEntryDetails(props: {
  entry: LocalModMetadataEntry;
  index: number;
  total: number;
}) {
  const entryTitle =
    props.entry.name?.trim() ||
    props.entry.modId?.trim() ||
    `${props.entry.loader} metadata`;

  return (
    <section
      className={
        props.index === 0
          ? "space-y-3"
          : "space-y-3 border-t border-gray-300 pt-3 dark:border-gray-700"
      }
    >
      {props.total > 1 && (
        <h4 className="text-xs font-semibold">
          {entryTitle} · Entry {props.index + 1}
        </h4>
      )}

      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <MetadataField label="Name">
          {declaredValue(props.entry.name)}
        </MetadataField>
        <MetadataField label="Version" monospace>
          {declaredValue(props.entry.version)}
        </MetadataField>
        <MetadataField label="Authors / contributors">
          {props.entry.authors.length > 0
            ? props.entry.authors.join(", ")
            : "Not declared"}
        </MetadataField>
        <MetadataField label="Mod ID" monospace>
          {declaredValue(props.entry.modId)}
        </MetadataField>
        <MetadataField label="Loader / format">
          {declaredValue(props.entry.loader)}
        </MetadataField>
        <MetadataField label="Loader version requirement" monospace>
          {declaredValue(props.entry.loaderVersion)}
        </MetadataField>
        {(props.entry.languageLoader || props.entry.languageLoaderVersion) && (
          <>
            <MetadataField label="Language loader">
              {declaredValue(props.entry.languageLoader)}
            </MetadataField>
            <MetadataField label="Language loader version" monospace>
              {declaredValue(props.entry.languageLoaderVersion)}
            </MetadataField>
          </>
        )}
        <MetadataField label="Minecraft version requirement" monospace>
          {declaredValue(props.entry.gameVersion)}
        </MetadataField>
        <MetadataField label="Environment">
          {declaredValue(props.entry.environment)}
        </MetadataField>
        <MetadataField label="Metadata source" monospace>
          {props.entry.source}
        </MetadataField>
      </dl>

      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold">Declared dependencies</h4>
        <DependencyList dependencies={props.entry.dependencies} />
      </div>
    </section>
  );
}

function ModMetadataDetails(props: { mod: LocalModFile }) {
  return (
    <div className="space-y-3">
      {props.mod.metadata.entries.length > 0 ? (
        keyedList(
          props.mod.metadata.entries,
          (entry) =>
            `${entry.source}-${entry.loader}-${entry.modId ?? ""}-${entry.name ?? ""}`,
        ).map(({ index, key, value: entry }) => (
          <MetadataEntryDetails
            entry={entry}
            index={index}
            key={key}
            total={props.mod.metadata.entries.length}
          />
        ))
      ) : props.mod.metadata.diagnostics.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          No supported metadata descriptor was found in this JAR.
        </div>
      ) : null}

      {props.mod.metadata.diagnostics.length > 0 && (
        <section className="space-y-1.5 border-t border-gray-300 pt-3 dark:border-gray-700">
          <h4 className="text-xs font-semibold">Metadata diagnostics</h4>
          <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-300">
            {keyedList(
              props.mod.metadata.diagnostics,
              (diagnostic) => diagnostic,
            ).map(({ key, value: diagnostic }) => (
              <li className="wrap-break-word" key={key}>
                {diagnostic}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModListItem(props: {
  mod: LocalModFile;
  busy: boolean;
  pending: boolean;
  expanded: boolean;
  onEnabledChange: (mod: LocalModFile, enabled: boolean) => void;
  onToggleDetails: (filename: string) => void;
}) {
  const summaryId = useId();
  const detailsId = useId();
  const displayName = modDisplayName(props.mod);

  return (
    <div>
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="pt-1">
          <Checkbox
            checked={props.mod.enabled}
            disabled={props.busy}
            onChange={(enabled) => props.onEnabledChange(props.mod, enabled)}
          >
            <span className="sr-only">
              {props.mod.enabled ? "Disable" : "Enable"} {displayName}
            </span>
          </Checkbox>
        </div>

        <button
          aria-controls={detailsId}
          aria-expanded={props.expanded}
          className="flex min-w-0 grow items-center gap-3 rounded text-left focus:outline-none focus:ring-2 ring-blue-500"
          id={summaryId}
          onClick={() => props.onToggleDetails(props.mod.filename)}
          type="button"
        >
          <div className="min-w-0 grow">
            <div
              className={`truncate text-sm font-medium ${props.mod.enabled ? "" : "text-gray-500 dark:text-gray-400"}`}
            >
              {displayName}
            </div>
            <div className="flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400">
              {keyedList(modSummaryParts(props.mod), (part) => part).map(
                ({ key, value: part }) => (
                  <span key={key}>{part}</span>
                ),
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs">
            {props.pending ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <span
                className={`rounded-full px-2 py-0.5 ${props.mod.enabled ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
              >
                {props.mod.enabled ? "Enabled" : "Disabled"}
              </span>
            )}
            {props.expanded ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )}
          </div>
        </button>
      </div>

      {props.expanded && (
        <section
          aria-labelledby={summaryId}
          className="border-t border-gray-300 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/30"
          id={detailsId}
        >
          <ModMetadataDetails mod={props.mod} />
        </section>
      )}
    </div>
  );
}

export default function InstanceModsView(props: {
  instance: MinecraftInstance;
}) {
  const app = useContext(AppContext);
  const [mods, setMods] = useState<LocalModFile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [expandedFilename, setExpandedFilename] = useState<string>();
  const [pendingFilenames, setPendingFilenames] = useState<Set<string>>(
    () => new Set(),
  );
  const scanRequestId = useRef(0);
  const mounted = useRef(true);

  const gameDirectory = props.instance.directory;
  const sharedInstanceCount = app
    .getData()
    .instances.filter(
      (instance) => instance.directory === gameDirectory,
    ).length;

  const refreshMods = useCallback(
    async (showErrorDialog = true): Promise<ModRefreshResult> => {
      if (!mounted.current) return { success: false };

      const requestId = ++scanRequestId.current;
      setLoading(true);
      setLoadError(undefined);

      try {
        const scannedMods = await scanLocalMods(gameDirectory);
        if (!mounted.current || requestId !== scanRequestId.current) {
          return { success: false };
        }
        setMods(scannedMods);
        setExpandedFilename((current) =>
          scannedMods.some((mod) => mod.filename === current)
            ? current
            : undefined,
        );
        return { success: true };
      } catch (err) {
        if (!mounted.current || requestId !== scanRequestId.current) {
          return { success: false };
        }
        const message = `${err}`;
        setLoadError(message);
        if (showErrorDialog) {
          app.openDialog({
            title: "Unable to Refresh Mods",
            message,
          });
        }
        return { success: false, error: message };
      } finally {
        if (mounted.current && requestId === scanRequestId.current) {
          setLoading(false);
        }
      }
    },
    [app.openDialog, gameDirectory],
  );

  useEffect(() => {
    mounted.current = true;
    setMods([]);
    setQuery("");
    setExpandedFilename(undefined);
    void refreshMods();

    return () => {
      mounted.current = false;
      scanRequestId.current += 1;
    };
  }, [refreshMods]);

  const searchableMods = useMemo(
    () =>
      mods.map((mod) => ({
        mod,
        searchText: modSearchText(mod),
      })),
    [mods],
  );

  const filteredMods = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return searchableMods
      .filter(
        ({ searchText }) =>
          normalizedQuery.length === 0 || searchText.includes(normalizedQuery),
      )
      .map(({ mod }) => mod)
      .sort((left, right) =>
        filenameCollator.compare(
          displayFilename(left.filename),
          displayFilename(right.filename),
        ),
      );
  }, [query, searchableMods]);

  const enabledCount = mods.filter((mod) => mod.enabled).length;
  const changingMod = pendingFilenames.size > 0;
  const busy = loading || importing || changingMod;

  const onReveal = async () => {
    const refreshResult = await refreshMods();
    if (!refreshResult.success || !mounted.current) return;

    try {
      await openPath(await path.join(gameDirectory, "mods"));
    } catch (err) {
      if (!mounted.current) return;
      app.openDialog({
        title: "Unable to Reveal Mods Directory",
        message: `${err}`,
      });
    }
  };

  const onImport = async () => {
    try {
      const selected = await open({
        title: "Import Mods",
        multiple: true,
        directory: false,
        filters: [{ name: "Minecraft Mods", extensions: ["jar"] }],
      });
      if (!selected || !mounted.current) return;

      const sourcePaths = Array.isArray(selected) ? selected : [selected];
      if (sourcePaths.length === 0) return;

      setImporting(true);
      const result = await importLocalMods(gameDirectory, sourcePaths);
      if (!mounted.current) return;

      const refreshResult = await refreshMods(false);
      if (!mounted.current) return;

      const refreshFailure = refreshResult.success
        ? ""
        : ` The import completed, but the list could not be refreshed${refreshResult.error ? `: ${refreshResult.error}` : "."}`;

      if (result.failed.length > 0) {
        app.openDialog({
          title: "Some Mods Were Not Imported",
          message: `Imported ${result.imported.length} of ${sourcePaths.length} mods. ${formatImportFailures(result.failed)}${refreshFailure}`,
        });
      } else if (!refreshResult.success) {
        app.openDialog({
          title: "Mods Imported, Refresh Failed",
          message: `Imported ${result.imported.length} ${result.imported.length === 1 ? "mod" : "mods"}.${refreshFailure}`,
        });
      } else {
        app.openToast({
          category: "success",
          content: `Imported ${result.imported.length} ${result.imported.length === 1 ? "mod" : "mods"}.`,
        });
      }
    } catch (err) {
      if (!mounted.current) return;
      app.openDialog({
        title: "Unable to Import Mods",
        message: `${err}`,
      });
    } finally {
      if (mounted.current) {
        setImporting(false);
      }
    }
  };

  const onEnabledChange = async (mod: LocalModFile, enabled: boolean) => {
    setPendingFilenames((previous) => {
      const next = new Set(previous);
      next.add(mod.filename);
      return next;
    });

    try {
      const updated = await setLocalModEnabled(
        gameDirectory,
        mod.filename,
        enabled,
      );
      if (!mounted.current) return;

      setMods((previous) =>
        previous.map((candidate) =>
          candidate.filename === mod.filename ? updated : candidate,
        ),
      );
      setExpandedFilename((current) =>
        current === mod.filename ? updated.filename : current,
      );
    } catch (err) {
      if (!mounted.current) return;
      app.openDialog({
        title: `Unable to ${enabled ? "Enable" : "Disable"} Mod`,
        message: `${err}`,
      });
    } finally {
      if (mounted.current) {
        setPendingFilenames((previous) => {
          const next = new Set(previous);
          next.delete(mod.filename);
          return next;
        });
      }
    }
  };

  const toggleModDetails = (filename: string) => {
    setExpandedFilename((current) =>
      current === filename ? undefined : filename,
    );
  };

  return (
    <div className="space-y-3 p-4">
      {sharedInstanceCount > 1 && (
        <div className="rounded-lg border border-gray-300 p-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
          This Mods directory is shared by {sharedInstanceCount} instances.
          Changes made here affect all of them.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => void onImport()}>
          <Upload size={16} />
          <span>{importing ? "Importing" : "Import Mods"}</span>
        </Button>
        <Button disabled={busy} onClick={() => void refreshMods()}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          <span>Refresh</span>
        </Button>
        <Button disabled={busy} secondary onClick={() => void onReveal()}>
          <FolderOpen size={16} />
          <span>Reveal Directory</span>
        </Button>
        <Input
          ariaLabel="Search installed mods"
          className="min-w-48 grow"
          placeholder="Search mod files"
          spellCheck={false}
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        {mods.length} {mods.length === 1 ? "mod" : "mods"} · {enabledCount}{" "}
        enabled
        {query.trim() && ` · ${filteredMods.length} matching`}
        {" · Changes take effect on the next launch"}
      </div>

      {loadError && (
        <div className="text-sm text-red-500">
          The Mods directory could not be refreshed: {loadError}
        </div>
      )}

      {loading && mods.length === 0 ? (
        <Center className="py-12">
          <div className="flex items-center">
            <Spin />
            <span>Loading mods</span>
          </div>
        </Center>
      ) : loadError && mods.length === 0 ? (
        <Center className="py-12">No mod files could be loaded.</Center>
      ) : mods.length === 0 ? (
        <Center className="py-12">
          No mods are installed. Use Import Mods to add JAR files.
        </Center>
      ) : filteredMods.length === 0 ? (
        <Center className="py-12">No mods match the current search.</Center>
      ) : (
        <div className="divide-y divide-gray-300 overflow-hidden rounded-lg border border-gray-300 dark:divide-gray-700 dark:border-gray-700">
          {filteredMods.map((mod) => {
            return (
              <ModListItem
                busy={busy}
                expanded={expandedFilename === mod.filename}
                key={mod.filename}
                mod={mod}
                pending={pendingFilenames.has(mod.filename)}
                onEnabledChange={(selectedMod, enabled) =>
                  void onEnabledChange(selectedMod, enabled)
                }
                onToggleDetails={toggleModDetails}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
