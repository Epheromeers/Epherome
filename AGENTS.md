# Epherome — Agent Instructions

Epherome is a cross-platform Minecraft launcher built with Tauri 2, Rust,
React, TypeScript, Vite, and Tailwind CSS v4. Frontend network requests are
proxied through the Rust backend.

## Architecture

```text
src/
  components/  Reusable UI primitives
  views/       Page-level UI and interaction wiring
  core/        Launching, authentication, downloads, assets, Java, and other business logic
  store/       App context, persisted user data, transient status, and theme handling
  utils/       Typed wrappers around generic Tauri capabilities

src-tauri/src/
  core/        Launcher-specific Tauri commands
  utils/       Generic filesystem and HTTP commands
  lib.rs       Plugin setup and command registration
```

Keep reusable or complex business logic in `src/core/`; views may contain
view-specific orchestration and local UI state. Use existing primitives in
`src/components/` before adding another one.

## Verification

After frontend changes, run:

```bash
npm run lint
npx tsc --noEmit
```

`npm run lint` runs Biome with auto-fixes and import organization. A full Vite
build is not required for routine validation.

After Rust changes, run from `src-tauri/`:

```bash
cargo fmt
cargo clippy
```

There is no test framework. Do not add one without explicit instruction.

## TypeScript and React

- Use plain `function` declarations for components and default-export the main
  component from each component file. Do not use `React.FC`, class components,
  or module-level arrow-function components.
- Type component props inline instead of creating named `*Props` interfaces.
- Use `interface` for record/API object shapes and `type` for unions,
  primitives, and intersections.
- Mark type-only imports with `type` and use relative paths for internal imports;
  the project has no path aliases.
- Access shared application state through `useContext(AppContext)`, conventionally
  stored in a variable named `app`.
- Generate application IDs with `nanoid()`.
- Do not use `any` unless unavoidable; explain an unavoidable use in a comment.
- Do not import Node.js built-ins in frontend code. Native operations belong
  behind Tauri commands.

Biome and TypeScript configuration are the source of truth for formatting,
import order, strictness, and unused-code checks.

## Styling

- Use Tailwind CSS v4 utilities. Do not use inline `style` props or `@apply`.
- Keep custom CSS limited to necessary global rules in `src/index.css`.
- Use Tailwind v4 canonical utility names. For word wrapping, use
  `wrap-break-word`, not the legacy `break-words` spelling.
- Do not add a component library. Extend the existing primitives when needed.
- Dark mode is driven by the custom variant in `src/index.css` and
  `updateTheme()` in `src/store/theme.ts`. Use `dark:` variants; do not add a
  `dark` class manually or introduce a separate media-query-based mechanism.
- Follow the existing visual language unless a redesign is requested:
  `border-gray-300 dark:border-gray-700` for borders, blue for primary actions,
  red for danger actions, and `focus:ring-2 ring-blue-500` for focus rings.

## State and navigation

Shared UI and user-data state is provided by `AppContext` in `src/store/index.ts`.
Its current surface includes navigation, launch status, dialogs, toasts, and
persisted user-data access. Treat the exported `AppContextType` as the source of
truth rather than duplicating its full interface here.

`app.setData()` supplies a structured clone of the current `UserData` to a
mutative updater:

```typescript
app.setData((data) => {
  data.accounts.forEach((account) => {
    account.checked = false;
  });
  selectedAccount.checked = true;
});
```

Do not return a replacement object from the updater, mutate `UserData` outside
`app.setData()`, or call `writeUserData()` after it. `App.tsx` persists the
result automatically.

Transient process output and collected browser errors live in
`src/store/status.ts`. Local interaction state belongs in components and views.

Navigation is internal state, not a router. Navigate with `app.setView()`; do
not add a routing or third-party state-management library without explicit
instruction.

## Tauri IPC

When adding a frontend/backend capability:

1. Add a `#[tauri::command] pub async fn` in the appropriate Rust `core/` or
   `utils/` module. Commands return `Result<T, String>` and must not panic.
2. Derive the required Serde traits for IPC structs and use
   `#[serde(rename_all = "camelCase")]` when Rust field names are exposed to
   TypeScript.
3. Export a new Rust module from its `mod.rs` and register the command in
   `src-tauri/src/lib.rs`.
4. Add a typed frontend wrapper in `src/utils/` for generic capabilities, then
   consume that wrapper from core code or views.

Prefer wrappers over new direct `invoke()` calls. The existing direct calls in
`src/core/auth.ts`, `src/core/index.ts`, and `src/core/java.ts` are
launcher-specific exceptions; do not broaden that pattern without a good
reason.

For backend push events, emit kebab-case event names from Rust and listen in
`main.tsx` for app-wide events or in a view effect for view-local events.

## Errors

- Show user-actionable failures through `app.openDialog()`; use
  `app.openToast()` for brief success/failure feedback where no decision is
  required.
- Stringify unknown caught values with a template literal such as `` `${err}` ``.
- In core code, throw descriptive errors for invalid preconditions. Return
  `null` only when absence is an expected, non-critical result.
- Recoverable integrity or download diagnostics may be logged. Do not silently
  swallow unexpected view errors.
- Rust commands must convert failures into descriptive `String` errors.
