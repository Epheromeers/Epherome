# Epherome — Agent Instructions

Epherome is a cross-platform Minecraft launcher built with **Tauri 2** (Rust backend) +
**React 19 + TypeScript** (frontend) + **Tailwind CSS v4**. Vite bundles the frontend;
Cargo compiles the native desktop shell.

---

## 1. Project Overview

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7 | UI, state, launch orchestration |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) | Utility-first, no component library |
| Icons | lucide-react | SVG icon set |
| IDs | nanoid | Unique IDs for accounts, instances, tasks |
| Backend | Rust, Tauri 2 | Native OS, file I/O, HTTP, process spawn |
| HTTP client | reqwest 0.11 (Rust) | All network requests go through Rust |
| Linter/Formatter | Biome 2 | Single tool replacing ESLint + Prettier |

Core business flows: Microsoft OAuth → Xbox/XSTS token chain → Minecraft token →
profile fetch; version JSON parsing; library/asset integrity checking; parallel
downloads; Fabric mod loader installation; Java detection and management.

---

## 2. Architecture & Directory Structure

```
src/
  main.tsx          # Entry: app init, data bootstrap, global error listener
  App.tsx           # Root: AppContext provider, sidebar nav, dialog overlay
  index.css         # Tailwind import + dark-mode custom variant
  components/       # 12 stateless UI primitives (Button, Input, Dialog, …)
  views/            # 11 full-page view components (*View.tsx)
  core/             # All business logic (launch, auth, download, assets, …)
    index.ts        # launchMinecraft orchestration entry point
    auth.ts         # Microsoft OAuth token chain
    download.ts     # File download, installMinecraft, installFabric
    assets.ts       # Asset index check/download
    libraries.ts    # Classpath/library resolution
    arguments.ts    # Minecraft launch argument parsing
    rules.ts        # OS platform rule compliance
    java.ts         # Java detection and version query
    parallel.ts     # ParallelManager (concurrent download class)
    skin.ts         # Skin fetching helper
  store/
    index.ts        # AppContext type + createContext + module-level globals
    data.ts         # UserData types, readUserData, writeUserData, fallbackUserData
    theme.ts        # updateTheme (data-theme attribute management)
  utils/
    fs.ts           # Typed wrappers over Rust FS commands (invoke calls only here)
    http.ts         # Typed wrappers over Rust fetch command (invoke calls only here)

src-tauri/src/
  lib.rs            # Plugin registration + invoke_handler command table
  main.rs           # Binary entry point
  core/
    auth.rs         # get_microsoft_auth_code (opens OAuth WebviewWindow)
    java.rs         # get_java_version (spawns java -version)
    runner.rs       # launch_minecraft (spawns process, emits process-output events)
    mod.rs
  utils/
    fs.rs           # read_text_file, write_text_file, exists, mkdir, read_dir, read_file, write_file
    http.rs         # fetch (reqwest-based, supports text/bytes response types)
    mod.rs
```

---

## 3. Commands

### Frontend

```bash
npm run dev          # Vite dev server only (no Tauri shell)
npm run build        # tsc type-check → vite build (full production build)
npm run preview      # Preview the production bundle
npm run lint         # Biome check --write (auto-fixes style + organizes imports)
npm run tauri dev    # Full Tauri app in development mode
npm run tauri build  # Production desktop binaries
```

### Verification After Changes

To verify frontend changes, run these two commands instead of `npm run build`
(which includes a slow Vite bundling step that is unnecessary for validation):

```bash
npm run lint         # Biome: auto-fix formatting + imports
npx tsc --noEmit    # TypeScript type-check only (no Vite build)
```

For Rust changes, run from the `src-tauri/` directory:

```bash
cargo clippy         # Lint
cargo fmt            # Format
```

### Rust Backend

```bash
# Run from src-tauri/ or use --manifest-path from root
cargo build
cargo clippy         # Lint
cargo fmt            # Format
```

### Tests

**There are no tests.** Do not add a test runner without explicit instruction.

---

## 4. Code Conventions

### 4.1 Naming Rules

| Entity | Convention | Examples |
|---|---|---|
| React components | PascalCase | `Button`, `DashboardView` |
| Component files | PascalCase `.tsx` | `Button.tsx`, `AccountsView.tsx` |
| View files | PascalCase + `View` suffix | `InstanceEditorView.tsx` |
| Non-component TS files | camelCase `.ts` | `auth.ts`, `download.ts`, `data.ts` |
| Functions | camelCase | `launchMinecraft`, `downloadFile` |
| Interfaces | PascalCase | `MinecraftClientJson`, `DialogOptions` |
| Type aliases | PascalCase | `ColorTheme`, `MinecraftVersionType` |
| Constants | camelCase | `fallbackUserData`, `errorList` |
| Local state variables | camelCase | `newJavaPath`, `modLoaderVersions` |
| Rust functions / commands | snake_case | `launch_minecraft`, `read_text_file` |
| Tauri IPC command strings | snake_case string literals | `"launch_minecraft"`, `"read_dir"` |
| Tauri event names | kebab-case strings | `"process-output"`, `"ms-auth-code"` |

### 4.2 TypeScript Type System

- **Prefer `interface`** for object shapes that describe data records or API
  contracts (`MinecraftAccount`, `FetchResponse`, `AppContextType`).
- **Use `type`** for unions, primitives, and intersection types
  (`ColorTheme = "light" | "dark" | "system"`, `MinecraftVersionType`).
- **All `import` of types must use the `type` keyword:**
  ```typescript
  import type { UserData } from "./store/data";
  import { type DialogOptions, AppContext } from "./store";
  ```
- **Never use `React.FC<>`** or `React.FunctionComponent`. Use plain function
  declarations with an inline prop object type.
- **Props are typed inline** — never create a separate named interface for props:
  ```typescript
  // CORRECT
  export default function Button(props: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) { ... }

  // WRONG — do not create ButtonProps interface
  ```
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true` are all on.
  Every unused import or variable is a compile error. Always run `npm run lint`
  then `npx tsc --noEmit` to verify.

### 4.3 React Component Rules

- Use **plain `function` declarations**, never arrow-function components.
- **`export default`** for every component file.
- No class components, no `forwardRef`.
- Access global app state exclusively via `useContext(AppContext)`, conventionally
  named `app`:
  ```typescript
  const app = useContext(AppContext);
  const data = app.getData();
  ```
- Use `useState(String())` (not `""`) as the canonical empty-string initial value
  when a prior value may be undefined:
  ```typescript
  const [name, setName] = useState(prev?.name ?? String());
  ```
- Use `nanoid()` for all unique ID generation (accounts, instances, parallel tasks).

### 4.4 Import Order

Biome's `organizeImports: "on"` enforces ordering automatically on `npm run lint`.
The observed order is:

1. Third-party packages (`lucide-react`, `nanoid`, `react`, `@tauri-apps/…`)
2. Internal relative imports (`../components/…`, `./store/…`, `../core`, `../utils/…`)

All internal imports use **relative paths** (`./` or `../`). There are **no path
aliases** — never use absolute internal imports.

### 4.5 Formatting

Enforced by Biome (run `npm run lint` before any commit):

- Indent: **2 spaces**
- Quotes: **double quotes** for all JS/TS strings
- CSS: Tailwind directive parsing enabled (`tailwindDirectives: true`)
- VCS: respects `.gitignore`

---

## 5. Styling Rules

- Use **Tailwind CSS v4 utility classes exclusively**. Do not write custom CSS
  except in `src/index.css` (which should stay minimal).
- **No inline `style` props.** Use Tailwind classes for all styling.
- **No `@apply`** directives — use atomic utility classes directly on elements.
- **No external component libraries** (shadcn/ui, MUI, etc.). Build UI from
  the existing primitives in `src/components/`.
- Dark mode uses a **non-standard Tailwind v4 custom variant** defined in
  `src/index.css`:
  ```css
  @custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
  ```
  Toggle is applied by `theme.ts` via `rootElement.setAttribute("data-theme", …)`.
  Apply dark variants as: `dark:bg-gray-800`, `dark:border-gray-700`,
  `dark:text-white`. **Never** use `className="dark"` or media-query hacks.
- Reuse the existing color scale that appears throughout the codebase:
  - Borders: `border-gray-300 dark:border-gray-700`
  - Panel backgrounds: `bg-white dark:bg-gray-700` / `dark:bg-gray-800`
  - Hover/active states: `hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600`
  - Primary action color: `bg-blue-400 hover:bg-blue-500 active:bg-blue-600`
  - Danger color: `bg-red-400 hover:bg-red-500 active:bg-red-600`
  - Focus ring: `focus:ring-2 ring-blue-500`

---

## 6. State Management

There is **no Redux, Zustand, or any third-party state library**. Do not add one.

All application state lives in a single `AppContextType` provided by `App.tsx`
and accessed via `useContext(AppContext)`. The context surface is:

```typescript
interface AppContextType {
  setView(viewName: string): void;
  getView(): string;
  setLaunchMessage(message: string | undefined): void;
  getLaunchMessage(): string | undefined;
  openDialog(options: DialogOptions): void;
  closeDialog(): void;
  getData(): UserData;
  setData(updater: (prevData: UserData) => void): void;
}
```

**The `setData` mutative pattern** — `setData` creates a shallow copy of the
top-level `UserData` object and passes it to the updater, which may mutate
nested properties directly. This is intentional:

```typescript
// CORRECT — mutate in place inside the updater
app.setData((prev) => {
  prev.accounts.forEach((a) => { a.checked = false; });
  selectedAccount.checked = true;
});

// WRONG — do not return or reconstruct objects
app.setData((prev) => ({ ...prev, accounts: [...prev.accounts] }));
```

`setData` also automatically persists to disk (`writeUserData`) — do not call
`writeUserData` manually after `setData`.

Navigation is a `useState` string in `App.tsx` — **not a router library**. Use
`app.setView("viewName")` to navigate.

Module-level mutable globals (defined in `src/store/index.ts`):
- `errorList: string[]` — collects uncaught browser errors from `window.onerror`
- `processOutputTable: { [nanoid]: ProcessOutput[] }` — stores Minecraft process
  stdout/stderr keyed by instance nanoid

---

## 7. IPC Workflow (Frontend ↔ Rust)

This section defines the **mandatory steps** for adding any new frontend–backend
interaction.

### Step 1 — Write the Rust command

Add it to the appropriate file in `src-tauri/src/core/` (business logic) or
`src-tauri/src/utils/` (generic OS capability). All commands must:

- Be decorated with `#[tauri::command]`
- Be `pub async fn`
- Return `Result<T, String>` — convert all errors to `String` via
  `.map_err(|e| format!("…: {}", e))` or `.map_err(|e| e.to_string())`
- Use `serde::Serialize` / `serde::Deserialize` on any struct passed across IPC
- Use `#[serde(rename_all = "camelCase")]` on structs serialized to JS

```rust
// src-tauri/src/core/example.rs
#[tauri::command]
pub async fn my_command(some_param: String) -> Result<String, String> {
    do_something(&some_param).map_err(|e| format!("my_command failed: {}", e))
}
```

### Step 2 — Declare the module and export

If you created a new file, add it to the parent `mod.rs`:

```rust
// src-tauri/src/core/mod.rs
pub mod example;
```

### Step 3 — Register in `lib.rs`

Import and add to `invoke_handler`:

```rust
use core::example::my_command;

tauri::generate_handler![
    // ... existing commands ...
    my_command,
]
```

### Step 4 — Add a typed wrapper in `src/utils/`

**Never call `invoke()` directly from views or core business logic.**
All `invoke()` calls must live in `src/utils/fs.ts` or `src/utils/http.ts` (or
a new utils file if the capability is unrelated to FS/HTTP):

```typescript
// src/utils/example.ts
import { invoke } from "@tauri-apps/api/core";

export async function myCommand(someParam: string): Promise<string> {
  return await invoke("my_command", { someParam });
}
```

### Step 5 — Use the wrapper from core or views

```typescript
// src/core/someFeature.ts
import { myCommand } from "../utils/example";

export async function doFeature() {
  const result = await myCommand("value");
  // ...
}
```

### Tauri Events (Backend → Frontend push)

Use `app.emit("event-name", payload)` in Rust and `listen("event-name", handler)`
in TypeScript. Wire event listeners in `main.tsx` (for app-wide events) or in
a `useEffect` inside the relevant view.

```typescript
// main.tsx (app-wide)
listen("process-output", (event) => { ... });
```

---

## 8. Error Handling

### In Views (user-visible errors)

Use `.catch()` on async operations and show errors through the dialog system:

```typescript
someAsyncOperation()
  .then((result) => { /* handle */ })
  .catch((err) => {
    app.openDialog({ title: "Error", message: `${err}` });
  });
```

Template-literal stringification `` `${err}` `` is the standard — it handles
both `Error` objects and unknown thrown values without `instanceof` checks.

### In Core / Utility Functions

- **Throw** a descriptive `Error` for invalid preconditions:
  ```typescript
  throw new Error("Mod loader already installed.");
  ```
- **Return `null`** for non-critical optional results:
  ```typescript
  export async function getJavaVersion(javaPath: string): Promise<string | null> {
    try {
      return await invoke("get_java_version", { javaPath });
    } catch {
      return null;
    }
  }
  ```
- **Log with `console.log`** for recoverable non-fatal issues (hash mismatches, etc.).

### In Rust Commands

Always return `Result<T, String>`. Never panic in a command — convert all errors
to descriptive strings:

```rust
fs::read_to_string(&pathname).map_err(|e| format!("Failed to read file: {}", e))
```

### Global Error Collection

Uncaught browser errors are collected in `main.tsx`:

```typescript
window.addEventListener("error", (event) => {
  errorList.push(event.message);
});
```

These are displayed in `TaskManagerView`. Do not swallow errors silently in views.

---

## 9. Do's and Don'ts

### Do

- Run `npm run lint` before finalizing changes — Biome auto-fixes formatting and
  import ordering in one pass.
- Run `npx tsc --noEmit` to verify TypeScript compiles without errors before
  declaring a task complete. This is faster than `npm run build` since it skips
  the Vite bundling step.
- Run `cargo clippy` and `cargo fmt` after any Rust changes.
- Keep views lean: only `useContext`, local UI state, and event handler wiring.
  All business logic belongs in `src/core/`.
- Use the existing component primitives (`Button`, `Input`, `ListItem`, `Dialog`,
  `Spin`, `Center`, `Label`, `Link`, `IconButton`, `TabButton`, `RadioButton`,
  `Checkbox`) before creating new ones.
- Use `nanoid()` for all new unique IDs.
- Persist state changes through `app.setData()` — it automatically writes to disk.

### Don't

- **Do not call `invoke()` directly from views or `src/core/` files** (except
  `src/core/auth.ts` and `src/core/index.ts` for commands that have no generic
  wrapper pattern). Always go through `src/utils/`.
- **Do not use `style={{…}}` inline styles.** Use Tailwind classes.
- **Do not use `@apply`** in CSS.
- **Do not import or use Node.js built-in modules** (`fs`, `path`, `os`, etc.)
  in frontend code. All OS operations go through Tauri IPC wrappers.
- **Do not add state management libraries** (Redux, Zustand, Jotai, Recoil, etc.).
- **Do not add a routing library** (React Router, TanStack Router, etc.). Navigation
  is a plain `useState` string.
- **Do not create named `*Props` interfaces** for component props — type them inline.
- **Do not use `React.FC<>` or arrow-function components** at the module level.
- **Do not use `new String()`** — use `String()` (without `new`) for empty-string
  initialization.
- **Do not add tests** without explicit instruction — no test framework is configured.
- **Do not use `any` type** unless unavoidable with a comment explaining why.
- **Do not mutate `UserData` outside of `app.setData()`** — always use the updater.
- **Do not call `writeUserData()` manually** after `app.setData()` — it persists
  automatically.
- **Do not break the dark mode system** by using `document.body.classList.add("dark")`
  or similar. Always use `updateTheme()` from `src/store/theme.ts`.
