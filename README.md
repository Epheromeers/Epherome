# Epherome

Epherome is a lightweight and versatile cross-platform Minecraft launcher built with Tauri.

> Project status: `beta`. Breaking changes and unstable behavior may occur between releases.

## Development

To run Epherome from source, it is recommended to follow these steps:
- Install Node.js, Rust, and other Tauri dependencies for your platform.
- Clone the repository and enter the repository root.
- Run `npm install` and `npm run tauri dev`.

Epherome uses Biome.js for linting and formatting. Use `npm run lint` to check for inconsistencies and automatically fix them if possible. It is recommended to run `npx tsc --noEmit` to perform type checking as well.

To verify Rust code, first run `cargo fmt` to clean up the code and then run `cargo clippy` for checking.

## Quickstart

Epherome artifacts are built with GitHub Actions and published to GitHub Releases.

Epherome will automatically detect JREs installed on your device. You can review them in Settings. Then log in to your account and create an instance by downloading or linking to existing files.

## Troubleshooting

If you have launch issues, use the built-in Task Manager to check whether the Minecraft process produced output.

## Versioning

Version numbers are defined in `package.json` and `src-tauri/Cargo.toml`. Epherome versions follow Semantic Versioning.

## License

This project is licensed under GNU General Public License v3.0 (`GPL-3.0`). See `LICENSE` for details.
